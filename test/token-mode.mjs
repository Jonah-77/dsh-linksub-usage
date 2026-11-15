/**
 * 令牌模式自测（离线，秒级）。
 *
 * 背景（2026-11-13）：linksub.fun 给密码登录开了人机验证（阿里云），
 * `POST /api/user/login` 一律回 `{success:false, message:"Human verification is required"}`，
 * 脚本再也没法自己登录。所以插件**只支持一种鉴权**：凭据文件里放一串系统访问令牌，
 * 直接当 `Authorization: Bearer` 用，全程不发登录请求。
 *
 * 现在的要求：
 *   A. 一次 `POST /api/user/login` 都不许打出去（loginCalls 恒为 0）；
 *   B. 每个请求都要带 `Authorization: Bearer <令牌>`；
 *   C. `/status` 报 `authMode:"token"`、`tokenHint` 为脱敏串（**不回显整串**）；
 *   D. 令牌被作废（401）时只给一句能行动的话，不重试、不回落登录；
 *   E. 空令牌视为「没配置」；
 *   F. GET 超时自动重试一次（上游抽风时别让整页报 500）。
 *
 * 跑法：node test/token-mode.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

// 引擎里的 cordis / js-yaml 位置因平台而异：优先环境变量，其次常见默认值。
// Windows 上本包位于 <profile>/node_modules/dsh-linksub-usage/，cordis 就在同级。
const ENGINE_NODE_MODULES = [
	process.env.ENGINE_NODE_MODULES,
	'/data/user/0/com.dsh.android/files/engine/node_modules',
	fileURLToPath(new URL('../node_modules', import.meta.url)),
].filter(Boolean).find((d) => fs.existsSync(d));
if (ENGINE_NODE_MODULES === undefined) {
	throw new Error('找不到引擎 node_modules：设 ENGINE_NODE_MODULES 环境变量指向引擎的 node_modules 目录');
}
// Windows 上传入的绝对路径（D:\…）不能直接 import，必须转成 file:// URL。
const CORDIS = pathToFileURL(path.join(ENGINE_NODE_MODULES, '@deepseek-ai/cordis/lib/index.js')).href;
const TMP_HOME = path.join(os.tmpdir(), 'linksub-token-' + process.pid);
process.env.DSH_HOME = TMP_HOME;
const CRED_DIR = path.join(TMP_HOME, 'linksub-usage');
const CRED_FILE = path.join(CRED_DIR, 'credentials.json');
const SITE_HOSTS = ['https://linksub.fun', 'https://api.linksub.fun', 'http://api.linksub.fun'];

const GOOD = 'good-token-abc123';
/** 脱敏后应该长这样：前 4 + … + 后 4。 */
const GOOD_HINT = GOOD.slice(0, 4) + '…' + GOOD.slice(-4);
let loginCalls = 0;
/** 下一次对 /api/user/self 的请求是否装成超时（只装一次）。 */
let timeoutNextSelf = false;
let timeoutInjected = 0;
/** 上游收到的 Authorization 头（去重后的集合）。 */
const seenAuth = new Set();

const upstream = http.createServer((req, res) => {
	const send = (s, p) => {
		res.writeHead(s, { 'content-type': 'application/json' });
		res.end(JSON.stringify(p));
	};
	if (req.url.startsWith('/api/status')) {
		return send(200, {
			success: true,
			data: { quota_per_unit: 500000, price: 7.3, quota_display_type: 'CNY', usd_exchange_rate: 1 },
		});
	}
	if (req.url === '/api/user/login' && req.method === 'POST') {
		loginCalls++;
		return send(200, { success: false, message: 'Human verification is required' });
	}
	const auth = String(req.headers.authorization ?? '');
	seenAuth.add(auth);
	if (auth !== `Bearer ${GOOD}`) {
		return send(401, { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized, invalid access token' });
	}
	if (req.url.startsWith('/api/user/self')) {
		return send(200, { success: true, data: { id: 1, username: 'tokenuser', quota: 1500000, used_quota: 250000 } });
	}
	if (req.url.startsWith('/api/data/self')) {
		return send(200, { success: true, data: [] });
	}
	if (req.url.startsWith('/api/token/')) {
		return send(200, { success: true, data: { page: 1, page_size: 100, total: 0, items: [] } });
	}
	// 分组倍率：价格页接口，插件会带系统访问令牌来读。
	if (req.url.startsWith('/api/pricing')) {
		return send(200, { success: true, group_ratio: { '破甲分组': 0.2 }, usable_group: {} });
	}
	if (req.url.startsWith('/api/user/topup/self')) {
		return send(200, { success: true, data: { page: 1, page_size: 20, total: 0, items: [] } });
	}
	return send(404, { success: false, message: 'not found' });
});
await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
const port = upstream.address().port;

const realFetch = globalThis.fetch;
globalThis.fetch = (u, i) => {
	const s = String(u);
	if (timeoutNextSelf && s.endsWith('/api/user/self')) {
		timeoutNextSelf = false;
		timeoutInjected++;
		return Promise.reject(Object.assign(new Error('simulated upstream hang'), { name: 'TimeoutError' }));
	}
	const target = SITE_HOSTS.find((h) => s.startsWith(h));
	if (target !== undefined) return realFetch('http://127.0.0.1:' + port + s.slice(target.length), i);
	return realFetch(u, i);
};

await fsp.mkdir(CRED_DIR, { recursive: true, mode: 0o700 });
const writeCreds = async (obj) => await fsp.writeFile(CRED_FILE, JSON.stringify(obj, null, 2));

const { Service, Context } = await import(CORDIS);
const plugin = await import('../lib/index.js');

const routes = [];
let gate = () => undefined;
class WebServer extends Service {
	constructor(c) {
		super(c, 'webServer');
	}
	register(r) {
		routes.push(r);
		return () => {};
	}
	get host() {
		return '127.0.0.1';
	}
	get protocol() {
		return 'http:';
	}
}
class Connection extends Service {
	constructor(c) {
		super(c, 'connection');
	}
	requestRejection() {
		return gate();
	}
}
const root = new Context();
new WebServer(root);
new Connection(root);

plugin.apply({
	webServer: root.webServer,
	get: (k) => (k === 'connection' ? root.connection : undefined),
	effect: (f) => f(),
	logger: { info() {}, warn(...a) { console.log('[warn]', ...a); } },
});
assert.equal(routes.length, 1);

const invoke = async (p, { method = 'GET', body } = {}) => {
	const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
	let sent = false;
	const req = Object.assign(
		new Readable({
			read() {
				if (sent) {
					this.push(null);
					return;
				}
				sent = true;
				this.push(bytes);
				this.push(null);
			},
		}),
		{ method, url: '/api/dsh-linksub' + p, headers: {} },
	);
	let status = 0,
		json;
	const res = {
		writeHead(c) {
			status = c;
			return res;
		},
		end(t) {
			json = t === undefined ? undefined : JSON.parse(t);
		},
	};
	await routes[0].handler(req, res);
	return { status, json };
};

const results = [];
const check = (name, fn) => {
	try {
		fn();
		results.push({ name, ok: true });
	} catch (e) {
		results.push({ name, ok: false, message: String(e?.message ?? e).slice(0, 300) });
	}
};

// A/B. 令牌模式：/data 成功，且全程零登录、每个请求都带 Bearer
await writeCreds({ accessToken: GOOD });
loginCalls = 0;
seenAuth.clear();
const a = await invoke('/data?days=1&force=1');
check('A 令牌模式拉数据成功', () => {
	assert.equal(a.status, 200, JSON.stringify(a.json).slice(0, 300));
	assert.equal(a.json.ok, true);
	assert.equal(a.json.data.user?.username, 'tokenuser');
});
check('A 一次密码登录都没发（人机验证就拦不到我们）', () => {
	assert.equal(loginCalls, 0, `上游收到 ${loginCalls} 次 POST /api/user/login`);
});
check('B 每个请求都带 Authorization: Bearer', () => {
	assert.deepEqual([...seenAuth], [`Bearer ${GOOD}`], JSON.stringify([...seenAuth]));
});

// C. /status 报 token 模式，且不回显令牌
const c = await invoke('/status');
check('C /status 报 authMode=token，令牌只给脱敏串', () => {
	assert.equal(c.status, 200);
	assert.equal(c.json.configured, true);
	assert.equal(c.json.authMode, 'token');
	assert.equal(c.json.tokenHint, GOOD_HINT);
	assert.equal(JSON.stringify(c.json).includes(GOOD), false, '整串令牌不该出现在 /status 响应里');
});

// F. GET 超时 → 自动重试一次（GET 幂等，上游抖一下不该整页报 500）
await writeCreds({ accessToken: GOOD });
loginCalls = 0;
timeoutInjected = 0;
timeoutNextSelf = true;
const f = await invoke('/data?days=1&force=1');
check('F GET 超时自动重试一次后成功', () => {
	assert.equal(timeoutInjected, 1, 'stub 没注入超时，测试本身没生效');
	assert.equal(f.status, 200, JSON.stringify(f.json).slice(0, 300));
	assert.equal(f.json.ok, true);
	assert.equal(loginCalls, 0);
});

// D. 令牌失效 → 不回落密码登录，给一句能行动的话
await writeCreds({ accessToken: 'revoked-token' });
loginCalls = 0;
const d = await invoke('/data?days=1&force=1');
check('D 令牌失效不回落到密码登录', () => {
	assert.notEqual(d.status, 200, '令牌失效不该报成功');
	assert.equal(loginCalls, 0, `上游收到 ${loginCalls} 次登录（回落了就会 > 0）`);
	assert.match(String(d.json?.message ?? ''), /系统访问令牌已失效/, String(d.json?.message ?? ''));
});

// E. 空文件 / 空令牌 → 仍算「没配置」
await writeCreds({ accessToken: '   ' });
const e = await invoke('/data?days=1&force=1');
check('E 空白令牌视为未配置', () => {
	assert.equal(e.status, 500);
	assert.equal(e.json?.error, 'no-credentials');
});

globalThis.fetch = realFetch;
upstream.close();
await fsp.rm(TMP_HOME, { recursive: true, force: true }).catch(() => {});

const failed = results.filter((r) => !r.ok);
console.log('');
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n      → ${r.message}`}`);
console.log('');
console.log(failed.length === 0 ? `TOKEN_MODE_OK (${results.length}/${results.length})` : `FAILED ${failed.length}/${results.length}`);
process.exitCode = failed.length === 0 ? 0 : 1;
