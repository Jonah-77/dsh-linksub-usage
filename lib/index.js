/**
 * dsh-linksub-usage —— 宿主半（host half）。
 *
 * ## 这个插件做什么
 *
 * linksub.fun 是 **New API** 面板（响应头 `x-new-api-version: v1.0.0-rc.46`），
 * 但这一版前端改过鉴权，**不是**老 one-api 那套「登录完直接带 cookie」。
 * 所有流程都用真实账号验证过，下面每一条都是实测结论，不是猜的。
 *
 * ## 鉴权：只用「系统访问令牌」（2026-11-13 起，**没有**密码登录）
 *
 * ```
 * credentials.json  →  {"accessToken": "<系统访问令牌>"}
 * 所有接口：Authorization: Bearer <系统访问令牌>
 *      ✅ 实测 /api/user/self、/api/data/self、/api/token/、/api/user/topup/self 全部 200
 * ```
 *
 * ⚠️ **为什么砍掉密码登录**（2026-11-13 实测）：站点 `/api/status` 出现
 *    `turnstile_check:true` + `bot_protection_provider:"aliyun"`，登录接口（`/api/user/` 下的 `login`）
 *    一律回 `{success:false, message:"Human verification is required"}`，
 *    **连账号密码都不校验**。人机验证是浏览器里跑阿里云 JS 过的，脚本永远过不去 ——
 *    「账号密码 + 自动重登」这条路在服务端就已经死了，代码里留着只会让人以为还有退路。
 *
 * 系统访问令牌（控制台 → 个人设置 → 系统访问令牌）**不会过期**，也不占站点的登录
 * 会话额度（`AUTH_SESSION_LIMIT`）。所以本插件现在一次登录请求都不发：不重登、
 * 不续期、不做并发重登合并、也没有登录节流。
 *
 * ## 数据接口（实测形态）
 *
 * | 接口 | 形态 | 注意 |
 * |---|---|---|
 * | `GET /api/user/self` | `{success, data:{quota, used_quota, request_count, …}}` | 扁平对象 |
 * | `GET /api/data/self?start_timestamp=&end_timestamp=` | `{success, data:[…]}` | **不带时间参数一律返回空数组** |
 * | `GET /api/log/self?p=&page_size=` | `{success, data:{page, page_size, total, items}}` | 分页字段在 `data` 里 |
 * | `GET /api/token/?p=&page_size=` | 同上 | **尾部斜杠不能少**，`/api/token` 会 404 |
 * | `GET /api/user/topup/self?p=&page_size=` | 同上 | 没充过值时 `total:0` |
 * | `GET /api/status` | `{data:{quota_per_unit, price, display_in_currency, …}}` | 无需登录 |
 * | `GET /api/pricing` | `{success, data:[…], group_ratio:{分组名:倍率}, usable_group:{…}}` | **倍率在顶层，不在 `data` 里** |
 *
 * ⚠️ **坑三：`/api/data/self` 不带时间参数返回空数组**（不是全量）。必须给
 *     `start_timestamp` / `end_timestamp`（秒级）。
 *
 * ⚠️ **坑四：`/api/token` 少了尾部斜杠就是 404**，`/api/token/` 才对。
 *
 * ## 金额换算（实测确认，不猜）
 *
 * `/api/status` 明确给出 `quota_per_unit: 500000`、`display_in_currency: true`、
 * `price: 7.3`。所以：
 *   - `quota / quota_per_unit` = 美元
 *   - 面板按 `price` 把美元折成人民币显示（本站 ¥7.3 / $1）
 * 本插件**每次抓取都读一次 `/api/status` 拿真实倍率**，读不到才回落到 500000 / 7.3，
 * 并在数据里带上 `quotaSource` 让界面说明来源。
 *
 * ## 分组计费倍率（2026-11-17 加）
 *
 * 「分组倍率」和上面的「额度换算倍率」是两回事，别混：
 *   - `quota_per_unit` = 500000 quota/$ —— 只是把内部的 quota 整数折成美元；
 *   - `group_ratio` = `{"破甲分组":0.2, …}` —— 该分组调用模型时按官方价乘几。
 *
 * 站点把分组倍率放在 **`GET /api/pricing` 的响应顶层** `group_ratio`（**不在** `data` 里，
 * `data` 是逐模型的价格表），同层还有 `usable_group`（分组备注，如「缓存优化测试」）。
 * 实测该站 14 个分组，`default` 没列在 `group_ratio` 里 —— 按 New API 规则默认组就是 ×1。
 * 这个接口无需登录，但要带系统访问令牌（`requireAuth:false` 的是价格页，接口仍按鉴权走）。
 *
 * 拿不到就**回落上次成功的快照**（`last-good.json` 里一并存了），绝不拿手工常量去猜 ——
 * 站点改价很频繁（公告里 10-27 国模全线涨价、11-15 GPT 福利组 0.07），写死的数字
 * 第二天就会变成错的。界面会标明来源 / 未取到。
 *
 * ## 已知的数据特性（不是 bug，界面要说明）
 *
 * - **令牌 `remain_quota` 可能是负数**：`unlimited_quota: true` 的令牌不扣额度，
 *   站点记的是「已用多少」，所以 remain 会一路变负。界面对无限令牌只显示已用。
 * - **令牌 `status`：1 = 启用，2 = 禁用**（实测 3 个令牌里 2 个是 2）。
 * - **`/api/log/self` 的 `type` 目前只见到 `2`**（消费）。`1 = 充值` 按 New API 惯例保留。
 * - **`quota` 是剩余、`used_quota` 是历史已用**，两者不重叠，所以「总额 = 两者之和」。
 *
 * ## 凭据怎么存
 *
 * `$DSH_HOME/linksub-usage/credentials.json`，权限 0600，只在本机，用于自动重登。
 * 界面有一键清除。**绝不回传密码**：状态接口只回显账号前 2 位。
 *
 * ## 安全：路由必须过引擎那把门
 *
 * 路由挂在 `/api/dsh-linksub/...`，一律先过 `connection.requestRejection(req)`
 * （查 Host 是否 loopback + 会话 cookie）。拿不到 `connection` 服务时 **503 fail-closed**，
 * 绝不降级 —— 否则手机上任意其它 App 都能读到你的余额与调用记录。
 *
 * @module dsh-linksub-usage
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

export const name = 'dsh-linksub-usage';

/** 只依赖 `webServer` 挂路由；`connection` 用 `ctx.get` 取（可能尚未就绪）。 */
export const inject = ['webServer'];

/** 接口前缀。客户端半的 `BASE` 必须与之一致。 */
const ROUTE_PREFIX = '/api/dsh-linksub';

/**
 * 站点候选地址。
 *
 * 官方说明这几个域名都可以访问（不同线路的优化不同），所以做成**回退链**：
 * 按顺序试，第一个通的就记住。实测 `api.linksub.fun` 在本机常被重置
 * （TLS connect error / connection reset），而 `linksub.fun` 的 https 稳定，
 * 所以它排第一。
 */
const SITE_CANDIDATES = [
	'https://linksub.fun',
	'https://api.linksub.fun',
	'http://api.linksub.fun',
];

/** 默认站点（用于 Origin / Referer 头；回退链命中后会换成实际用的那个）。 */
const DEFAULT_SITE = SITE_CANDIDATES[0];

/** `/api/status` 读不到时的兜底倍率（实测本站就是 500000）。 */
const FALLBACK_QUOTA_PER_UNIT = 500000;

/** `/api/status` 读不到时的兜底汇率（实测本站 7.3）。 */
const FALLBACK_PRICE_RATIO = 7.3;

/**
 * 上游超时。实测正常几百毫秒。
 *
 * ⚠️ 2026-10-30 由 15s 放宽到 25s：diag.log 抓到一次上游抽风，15s 硬超时直接让
 *    整个 `/data` 报 500（`请求 登录接口超时（15000ms）`），而紧接着重试的那次
 *    请求本身要 10.8s 才回 —— 15s 太贴边，稍微抖一下就被误判成「上游真挂了」。
 */
const UPSTREAM_TIMEOUT_MS = 25000;

/** 数据缓存时长：避免连点刷新把上游打成限流。 */
const CACHE_TTL_MS = 60 * 1000;

/**
 * **永远按这么多天拉一次**，不按用户当前选的天数拉。
 *
 * ⚠️ 为什么：界面上 1 天 / 7 天 / 30 天三档，`/api/data/self` 的请求是**一样的**
 *    （都只要 start_timestamp 起，1 天和 7 天拿到的数据本身就是 30 天的子集），
 *    差别只在本地聚合粒度。缓存 key 里带天数的话，切一次档就整轮重拉，
 *    白白多打 4 个上游接口。所以固定按 30 天拉一次、缓存不跟天数挂钩：
 *    首屏拉一遍，之后切档全部命中缓存、本地重算。
 */
const FETCH_DAYS = 30;

/** 调用记录 / 令牌各拉多少条。够看趋势，又不至于把响应撑大。 */
const TOKEN_PAGE_SIZE = 100;

let gateWarned = false;

// ─────────────────────────────── 凭据与路径 ───────────────────────────────

/** 凭据文件与缓存文件的落点。`DSH_HOME` 缺失时插件不注册（注册了也存不了）。 */
function paths() {
	// 引擎不保证给插件注入 DSH_HOME（Windows 桌面版实测未注入），缺了就回落到 ~/.dsh。
	const home = process.env.DSH_HOME ?? path.join(homedir(), '.dsh');
	if (!home) return undefined;
	const dir = path.join(home, 'linksub-usage');
	return {
		dir,
		credentials: path.join(dir, 'credentials.json'),
		cache: path.join(dir, 'last-good.json'),
		/** 诊断日志：宿主半 + 前端上报的耗时/失败都写这里（`diag.log`）。 */
		diag: path.join(dir, 'diag.log'),
	};
}

// ─────────────────────────────── 诊断日志 ───────────────────────────────

/** 内存里保留的最近行数（`GET /diag` 直接读它）。 */
const DIAG_MEM_MAX = 500;
/** 落盘上限：超了整份丢掉重来。这个文件只需要「最后几百行」，历史没有价值。 */
const DIAG_FILE_MAX = 512 * 1024;
const diagLines = [];

/** `HH:mm:ss.SSS`（本地时区）。诊断日志的时间戳够分辨先后就行。 */
function diagStamp() {
	const d = new Date();
	const pad = (v, n = 2) => String(v).padStart(n, '0');
	return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/**
 * 记一条诊断日志：进内存环形缓冲，并异步追加到 `diag.log`。
 *
 * ⚠️ **绝不 await、绝不抛出**：这是观测代码，慢或失败都不许影响真实请求。
 * @param scope - 来源标签（`web` / `data` / `error` …）。
 * @param message - 一行内容（**不要把密码/令牌写进来**）。
 */
function diag(scope, message) {
	const line = `${diagStamp()} [${scope}] ${message}`;
	diagLines.push(line);
	if (diagLines.length > DIAG_MEM_MAX) diagLines.splice(0, diagLines.length - DIAG_MEM_MAX);
	const p = paths();
	if (p === undefined) return;
	(async () => {
		try {
			const st = await fsp.stat(p.diag);
			if (st.size > DIAG_FILE_MAX) await fsp.rm(p.diag, { force: true });
		} catch {
			// 文件还不存在：正常，接着写就行。
		}
		await fsp.appendFile(p.diag, `${new Date().toISOString()} ${line}\n`);
	})().catch(() => {});
}

/**
 * 同步读凭据；不存在或坏了都返回 undefined（当成「没登录」）。
 *
 * @param p - {@link paths} 的返回值。**这里要用 `p.credentials`**：
 *   早期版本误把整个对象当路径传给 `readFileSync`，结果是「已登录却提示未配置」。
 * @returns `{accessToken}`，没有则 undefined（**只有令牌模式**）。
 *
 * ⚠️ 账号密码已彻底删掉（2026-11-13，见文件头）：站点给登录接口挂了
 *    人机验证，脚本登录必被拦。老文件里残留的 `username` / `password` **直接忽略**。
 */
function readCredentials(p) {
	try {
		const raw = JSON.parse(fs.readFileSync(p.credentials, 'utf8'));
		const accessToken = typeof raw?.accessToken === 'string' ? raw.accessToken.trim() : '';
		if (accessToken === '') return undefined;
		return { accessToken };
	} catch {
		return undefined;
	}
}

/** 0600 落盘凭据。目录不存在就建。 */
async function writeCredentials(p, credentials) {
	await fsp.mkdir(p.dir, { recursive: true, mode: 0o700 });
	const tmp = `${p.credentials}.tmp`;
	await fsp.writeFile(tmp, JSON.stringify(credentials, null, 2), { mode: 0o600 });
	await fsp.rename(tmp, p.credentials);
	await fsp.chmod(p.credentials, 0o600).catch(() => {});
}

/** 删掉凭据与快照。 */
async function deleteCredentials(p) {
	for (const file of [p.credentials, p.cache]) {
		await fsp.rm(file, { force: true }).catch(() => {});
	}
}

// ─────────────────────────────── 站点探测 ───────────────────────────────

/**
 * 记住「上次实际通的站点」，下次优先试它 —— 省掉每轮的探测往返。
 * 只是一个提示：探测失败会重新走整条回退链。
 */
let preferredSite = undefined;

/**
 * 探测可用站点：按回退链顺序试 `GET /api/status`（无需登录，最快能判定通不通），
 * 第一个返回 200 且是 JSON 的就用它。
 *
 * @returns 可用站点地址；全都不通时回落到 {@link DEFAULT_SITE}（让上层报明确的网络错误，
 *   而不是一个「找不到站点」的模糊错误）。
 */
async function resolveSite() {
	const order = preferredSite === undefined ? SITE_CANDIDATES : [preferredSite, ...SITE_CANDIDATES.filter((s) => s !== preferredSite)];
	for (const site of order) {
		try {
			const res = await fetch(site + '/api/status', {
				method: 'GET',
				headers: { accept: 'application/json' },
				signal: AbortSignal.timeout(8000),
				redirect: 'manual',
			});
			// 200/3xx 且内容像 JSON 就算通（有的线路会有一次跳转）。
			if (res.status === 200) {
				const text = await res.text();
				JSON.parse(text);
				preferredSite = site;
				return site;
			}
		} catch {
			// 这个域名不通，试下一个。
		}
	}
	return DEFAULT_SITE;
}

// ─────────────────────────────── 上游会话 ───────────────────────────────

/** 上游错误：带 HTTP 状态与 `kind`，让界面能说清是「密码错」还是「站点挂了」。 */
class UpstreamError extends Error {
	constructor(message, status = 0, kind = 'upstream') {
		super(message);
		this.name = 'UpstreamError';
		this.status = status;
		this.kind = kind;
	}
}

/**
 * 把「校验系统访问令牌」失败的**上游原文**翻成人话。
 *
 * 校验令牌就是一次普通的 `GET /api/user/self`：401 = 令牌不对或已被重置；
 * 200 但 `success:false` = 站点在闹别的脾气，原文照抄比瞎猜强。
 *
 * @param status - HTTP 状态码。
 * @param json - 上游响应体（可能 undefined）。
 * @returns 给用户看的一句话（不含「连接失败：」前缀，那个由调用方加）。
 */
function describeTokenFailure(status, json) {
	const code = String(json?.code ?? '');
	const raw = String(json?.message ?? json?.message_key ?? '');
	if (status === 401 || code === 'AUTH_UNAUTHORIZED' || /unauthori[sz]ed|invalid access token|未登录/i.test(raw)) {
		return '系统访问令牌无效：请到 linksub.fun「控制台 → 个人设置 → 系统访问令牌」重新生成，注意整串复制、别带多余空格';
	}
	if (/human verification|turnstile|captcha/i.test(raw)) {
		return '站点要求人机验证（校验令牌不该走到这里）。刷新页面重试；若持续出现，说明站点又改了鉴权，需要重新适配插件';
	}
	if (raw !== '') return raw;
	return `HTTP ${status}`;
}

/**
 * 一个上游会话：拿着**系统访问令牌**直接调接口。
 *
 * 没有登录、没有续期、没有并发重登合并、没有 cookie 那一套 —— 令牌模式下
 * 这些东西不存在，就不该留代码。`collectAll` 一次性创建一个实例并发跑 4 个接口。
 */
class Upstream {
	/**
	 * @param accessToken - 站点「系统访问令牌」（控制台 → 个人设置）。
	 * @param site - 实际使用的站点地址（来自回退链探测结果）。
	 */
	constructor(accessToken, site) {
		if (typeof accessToken !== 'string' || accessToken === '') {
			throw new UpstreamError('没有可用的系统访问令牌', 0, 'no-credentials');
		}
		this.accessToken = accessToken;
		/** 本次会话实际使用的站点地址（来自回退链探测结果，或上次成功记住的）。 */
		this.site = site ?? DEFAULT_SITE;
	}

	/**
	 * 带超时的 GET。**`redirect: 'manual'`**：面板若把异常请求 302 到中间页，
	 * 自动跟随会拿到一页 HTML 当 JSON 解析，错误信息就完全失去意义。
	 *
	 * 超时**自动重试一次**：GET 幂等，而超时是上游抽风的典型表现
	 * （实测正常 0.4s、抖动时 >10s），一次抖动不该让整页报 500。
	 *
	 * @param route - 以 `/` 开头的路径（可带查询串）。
	 * @param attempt - 内部用：这是第几次尝试（`1` = 首次）。**调用方不要传**。
	 * @returns `{status, json}`。
	 */
	async request(route, attempt = 1) {
		try {
			const res = await fetch(this.site + route, {
				method: 'GET',
				headers: {
					accept: 'application/json',
					origin: this.site,
					referer: `${this.site}/`,
					authorization: `Bearer ${this.accessToken}`,
				},
				signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
				redirect: 'manual',
			});
			const text = await res.text();
			let json;
			try {
				json = text === '' ? undefined : JSON.parse(text);
			} catch {
				throw new UpstreamError(`上游返回的不是 JSON（HTTP ${res.status}），可能被中间页拦截`, res.status);
			}
			return { status: res.status, json };
		} catch (error) {
			if (error instanceof UpstreamError) throw error;
			if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
				if (attempt < 2) return this.request(route, attempt + 1);
				const timeout = new UpstreamError(`请求 ${route} 超时（${UPSTREAM_TIMEOUT_MS}ms）`, 0);
				timeout.timeout = true;
				throw timeout;
			}
			throw new UpstreamError(`请求 ${route} 失败：${String(error?.message ?? error)}`, 0);
		}
	}

	/**
	 * 带鉴权的 GET，解析出上游的 `data` 字段。
	 *
	 * 令牌不对就直接报一句能行动的话，**不重试**：系统访问令牌被作废只有一种解法
	 * —— 去站点重新生成。多打几次上游毫无意义，也躲不掉人机验证。
	 *
	 * @param route - 形如 `/api/user/self`。
	 * @returns 上游的 `data` 字段。
	 */
	async get(route) {
		const attempt = await this.request(route);
		if (isSessionExpired(attempt)) {
			throw new UpstreamError(
				'系统访问令牌已失效（站点可能重置过）：请到 linksub.fun「控制台 → 个人设置 → 系统访问令牌」重新生成，替换凭据文件里的 accessToken 后重启 App',
				attempt.status,
				'login',
			);
		}
		const json = attempt.json;
		if (json?.success === false) {
			throw new UpstreamError(`${route} 返回失败：${json?.message ?? json?.message_key ?? 'unknown'}`, attempt.status);
		}
		return json?.data;
	}

	/**
	 * 分页列表接口。
	 *
	 * 实测形态是 `{success:true, data:{page, page_size, total, items:[…]}}`，
	 * 但也见过 `data` 直接是数组的版本，两种都认。
	 *
	 * @param route - 形如 `/api/token/`。
	 * @param options - `{p, pageSize}`。
	 * @returns `{items, total}`。
	 */
	async list(route, { p = 1, pageSize = 100 } = {}) {
		const sep = route.includes('?') ? '&' : '?';
		const data = await this.get(`${route}${sep}p=${p}&page_size=${pageSize}`);
		if (Array.isArray(data)) return { items: data, total: data.length };
		const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : [];
		const total = Number.isFinite(data?.total) ? data.total : items.length;
		return { items, total };
	}
}


/**
 * 这个响应是不是「会话过期」？
 *
 * 两种表现都认：
 *  - `401`（实测就是这种，body 为 `{code:"AUTH_UNAUTHORIZED", message:"Unauthorized, invalid access token"}`）
 *  - `200` + `success:false` + 消息里带 Unauthorized / 未登录 / access token
 *
 * @param attempt - `{status, json}`。
 * @returns 需要重登时 true。
 */
function isSessionExpired(attempt) {
	if (attempt.status === 401) return true;
	if (attempt.json?.success !== false) return false;
	const text = String(attempt.json?.message ?? attempt.json?.message_key ?? attempt.json?.code ?? '');
	return /未登录|Unauthorized|access token|invalid token/i.test(text);
}

// ─────────────────────────────── 数据整形 ───────────────────────────────

/**
 * 把若干按天（或按小时）的行**合并成一行**。
 *
 * 「今日消耗」要跨多个小时格相加，1 天粒度下 24 个格子都得算进去，
 * 所以不能像以前那样「按日期的键 find 一行」——那在小时粒度下永远找不到。
 *
 * @param rows - `{day, quota, usd, count, tokens}` 数组。
 * @returns 合并后的单行；空数组时返回全 0 的一行（`day` 为空串）。
 */
function sumRows(rows) {
	const out = { day: rows[0]?.day ?? '', quota: 0, usd: 0, count: 0, tokens: 0 };
	for (const row of rows) {
		out.quota += Number(row?.quota) || 0;
		out.usd += Number(row?.usd) || 0;
		out.count += Number(row?.count) || 0;
		out.tokens += Number(row?.tokens) || 0;
	}
	return out;
}

/** quota 整数 → 美元。倍率由 `/api/status` 实测得到，不写死。 */
function toUsd(quota, quotaPerUnit) {
	const n = Number(quota);
	if (!Number.isFinite(n)) return 0;
	return n / quotaPerUnit;
}

/** 本地时区的 `YYYY-MM-DD`。**不能用 toISOString** —— 那是 UTC，会把凌晨的用量算到前一天。 */
function localDay(epochSeconds) {
	const d = new Date(epochSeconds * 1000);
	const pad = (v) => String(v).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 本地时区的 `HH:00` 桶键，例如 `10-25 09:00`。按小时看时用这个。 */
function localHourKey(epochSeconds) {
	const d = new Date(epochSeconds * 1000);
	const pad = (v) => String(v).padStart(2, '0');
	return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
}

/**
 * 时间点 → 它所属的「锚点」：整点或 12 小时格（00:00 / 12:00）。
 *
 * 用**时间戳取整**而不是把字符串贴起来，跨天算才不会错。
 *
 * @param epochSeconds - 任意时间点。
 * @param stepHours - 1 = 按整点，12 = 按 12 小时格。
 * @returns 锚点的 epoch 秒（整除，一定落在格子的起点上）。
 */
function anchorEpoch(epochSeconds, stepHours) {
	const step = stepHours * 3600;
	// 12 小时格必须对齐本地 0 点，用本地日期算出当天 0 点再加整格偏移。
	const d = new Date(epochSeconds * 1000);
	d.setHours(0, 0, 0, 0);
	const dayStart = Math.floor(d.getTime() / 1000);
	const offset = Math.max(0, epochSeconds - dayStart);
	return dayStart + Math.floor(offset / step) * step;
}

/** 锚点 → 桶键：`MM-DD HH:00`。 */
function anchorKey(epochSeconds) {
	return localHourKey(epochSeconds);
}

/**
 * 补齐最近 24 个小时桶（含当前这一小时），**没有用量的小时也留 0**。
 *
 * 上游只返回「有用量的小时」，所以 1 天的图以前只有 18 根柱子 —— 空白的那几个小时
 * 直接消失了，看的人会以为图被截断。这里按本地整点生成 24 个桶，缺的补 0。
 *
 * @param rows - 已经按小时聚合好的数组（`{day:'MM-DD HH:00', …}`）。
 * @param nowSeconds - 当前时间（epoch 秒），测试时可注入。
 * @returns 24 项的数组，从「23 小时前」到「当前小时」。
 */
function fillHourBuckets(rows, nowSeconds = Math.floor(Date.now() / 1000)) {
	const byKey = new Map(rows.map((r) => [r.day, r]));
	const base = new Date(nowSeconds * 1000);
	base.setMinutes(0, 0, 0);
	const out = [];
	for (let i = 23; i >= 0; i -= 1) {
		const at = Math.floor(base.getTime() / 1000) - i * 3600;
		const key = localHourKey(at);
		out.push(byKey.get(key) ?? { day: key, quota: 0, usd: 0, count: 0, tokens: 0, models: [] });
	}
	return out;
}

/**
 * 补齐 7 天窗口的 **12 小时格**（当前格 + 往前 13 个 = 14 格）。
 *
 * 7 天 = 168 小时，按小时画就是 168 根柱子，手机上根本数不清；
 * 按天画又只有 7 根，看不出「白天还是半夜在烧钱」。12 小时格两头都兼顾：
 * 14 根柱子，横轴是 `10-19 12:00 / 10-20 00:00 / …`。
 *
 * @param rows - 已经按 12 小时聚合好的数组。
 * @param nowSeconds - 当前时间（epoch 秒）。
 * @returns 14 项数组，按时间正序。
 */
function fillHalfDayBuckets(rows, nowSeconds = Math.floor(Date.now() / 1000)) {
	const byKey = new Map(rows.map((r) => [r.day, r]));
	const current = anchorEpoch(nowSeconds, 12);
	const out = [];
	for (let i = 13; i >= 0; i -= 1) {
		const key = anchorKey(current - i * 12 * 3600);
		out.push(byKey.get(key) ?? { day: key, quota: 0, usd: 0, count: 0, tokens: 0, models: [] });
	}
	return out;
}

/** 最近 N 天的起点（本地 0 点，epoch 秒）。 */
function daysAgoEpoch(days) {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - (days - 1));
	return Math.floor(d.getTime() / 1000);
}

/**
 * 把 `/api/data/self` 的原始数组整形成：按天曲线 + 按模型聚合 + 总计。
 *
 * 实测每一项：
 * `{id:0, user_id, username, model_name, created_at:秒, use_group, token_id,
 *   token_used, count, quota, cache_read_tokens, cache_creation_tokens}`
 *
 * @param raw - 上游数组。
 * @param quotaPerUnit - 换算倍率。
 * @param bucket - `'hour'` / `'half'`（12 小时格）/ `'day'`：`days` 数组的聚合粒度。
 *   短范围（≤2 天）时按天只有一两根柱子，看不出形态，所以短的按小时。
 * @returns 整形后的对象。
 */
function shapeQuotaData(raw, quotaPerUnit, bucket = 'day') {
	/** 1 = 整点，12 = 12 小时格，0 = 按天。 */
	const stepHours = bucket === 'hour' ? 1 : bucket === 'half' ? 12 : 0;
	const rows = Array.isArray(raw) ? raw : [];
	const byDay = new Map();
	const byModel = new Map();
	let totalQuota = 0;
	let totalCount = 0;
	let totalTokens = 0;

	for (const row of rows) {
		if (row === null || typeof row !== 'object') continue;
		const quota = Number(row.quota) || 0;
		const count = Number(row.count) || 0;
		const tokens = Number(row.token_used) || 0;
		const model = String(row.model_name ?? row.model ?? '未知');
		const created = Number(row.created_at);
		const at = Number.isFinite(created) && created > 0 ? created : Math.floor(Date.now() / 1000);
		const day = stepHours > 0 ? anchorKey(anchorEpoch(at, stepHours)) : localDay(at);

		totalQuota += quota;
		totalCount += count;
		totalTokens += tokens;

		const dayRow = byDay.get(day) ?? { day, quota: 0, count: 0, tokens: 0, models: new Map() };
		dayRow.quota += quota;
		dayRow.count += count;
		dayRow.tokens += tokens;
		dayRow.models.set(model, (dayRow.models.get(model) ?? 0) + quota);
		byDay.set(day, dayRow);

		byModel.set(model, (byModel.get(model) ?? 0) + quota);
	}

	const days = [...byDay.values()]
		.sort((a, b) => (a.day < b.day ? -1 : 1))
		.map((d) => ({
			day: d.day,
			quota: d.quota,
			usd: toUsd(d.quota, quotaPerUnit),
			count: d.count,
			tokens: d.tokens,
			models: [...d.models.entries()]
				.map(([model, quota]) => ({ model, quota, usd: toUsd(quota, quotaPerUnit) }))
				.sort((a, b) => b.quota - a.quota),
		}));

	const models = [...byModel.entries()]
		.map(([model, quota]) => ({ model, quota, usd: toUsd(quota, quotaPerUnit) }))
		.sort((a, b) => b.quota - a.quota);

	return { days, models, totalQuota, totalUsd: toUsd(totalQuota, quotaPerUnit), totalCount, totalTokens };
}

/**
 * 用户对象 → 界面要的字段。
 *
 * 实测 25 个字段，有用的就这些。`setting` / `sidebar_modules` / `permissions`
 * 是前端 UI 状态，与用量无关，**不回传**（别浪费带宽）。
 *
 * @param user - 上游 `data`。
 * @param quotaPerUnit - 换算倍率。
 * @param priceRatio - 美元面值 → 面板显示单位的乘数（USD 站恒为 1，见 displayMoneyOf）。
 */
function shapeUser(user, quotaPerUnit, priceRatio) {
	if (user === null || typeof user !== 'object') return undefined;
	const remaining = Number(user.quota) || 0;
	const used = Number(user.used_quota) || 0;
	const affQuota = Number(user.aff_quota) || 0;
	const affHistory = Number(user.aff_history_quota) || 0;
	const remainingUsd = toUsd(remaining, quotaPerUnit);
	return {
		id: Number(user.id) || 0,
		displayName: String(user.display_name ?? user.username ?? ''),
		username: String(user.username ?? ''),
		email: String(user.email ?? ''),
		group: String(user.group ?? ''),
		role: Number(user.role) || 0,
		/** 1 = 正常（实测）。其它值按异常显示。 */
		status: Number(user.status) || 0,
		hasPassword: user.has_password === true,
		remainingQuota: remaining,
		remainingUsd,
		/** 面板显示单位的余额（本站 quota_display_type=USD，所以就等于 remainingUsd）。 */
		remainingCny: remainingUsd * priceRatio,
		usedQuota: used,
		usedUsd: toUsd(used, quotaPerUnit),
		usedCny: toUsd(used, quotaPerUnit) * priceRatio,
		/** 余额 + 已用：`quota` 是**剩余**，`used_quota` 是**历史已用**，两者不重叠。 */
		totalQuota: remaining + used,
		totalUsd: toUsd(remaining + used, quotaPerUnit),
		requestCount: Number(user.request_count) || 0,
		affQuota,
		affUsd: toUsd(affQuota, quotaPerUnit),
		affHistoryQuota: affHistory,
		affHistoryUsd: toUsd(affHistory, quotaPerUnit),
		affCount: Number(user.aff_count) || 0,
		affCode: String(user.aff_code ?? ''),
		inviterId: Number(user.inviter_id) || 0,
	};
}

/**
 * 令牌（API key）→ 界面要的字段。**不回传 `key` 明文**：那列一泄露就是别人能用你的额度。
 *
 * 实测：
 *  - `unlimited_quota: true` 时 `remain_quota` 会是**负数**（站点记的是已用量），
 *    所以无限令牌**不显示「剩余」**，只显示「已用」。
 *  - `status`：1 = 启用，2 = 禁用。
 *
 * @param row - 上游一条令牌。
 * @param quotaPerUnit - 换算倍率。
 */
function shapeToken(row, quotaPerUnit) {
	if (row === null || typeof row !== 'object') return undefined;
	const used = Number(row.used_quota) || 0;
	const remain = Number(row.remain_quota) || 0;
	const unlimited = row.unlimited_quota === true;
	return {
		id: Number(row.id) || 0,
		name: String(row.name ?? ''),
		/** 上游已经脱敏成 `sk-xxx****yyy`；直接展示，不再二次加工。 */
		maskedKey: String(row.key ?? ''),
		unlimited,
		/** 无限令牌的 remain 是负数、没有意义，置 0 让界面别显示。 */
		remainQuota: unlimited ? 0 : remain,
		remainUsd: unlimited ? 0 : toUsd(remain, quotaPerUnit),
		usedQuota: used,
		usedUsd: toUsd(used, quotaPerUnit),
		/** -1 表示永不过期（实测）。 */
		expiredAt: Number(row.expired_time) > 0 ? Number(row.expired_time) : -1,
		createdAt: Number(row.created_time) || 0,
		accessedAt: Number(row.accessed_time) || 0,
		/** 1 = 启用，2 = 禁用。 */
		status: Number(row.status) || 0,
		group: String(row.group ?? ''),
	};
}

/**
 * 充值记录 → 界面要的字段。
 *
 * @param row - 上游一条充值。
 * @param quotaPerUnit - 换算倍率。
 */
function shapeTopup(row, quotaPerUnit) {
	if (row === null || typeof row !== 'object') return undefined;
	const amount = Number(row.amount) || 0;
	return {
		id: Number(row.id) || 0,
		/** `amount` 是充进去的额度（quota），`money` 是实付金额。 */
		amountQuota: amount,
		amountUsd: toUsd(amount, quotaPerUnit),
		money: Number(row.money) || 0,
		tradeNo: String(row.trade_no ?? ''),
		createdAt: Number(row.create_time) || 0,
		status: String(row.status ?? ''),
	};
}

// ─────────────────────────────── 抓一次全量 ───────────────────────────────

/**
 * 读站点的额度倍率与汇率。
 *
 * `/api/status` 无需登录，返回里有 `quota_per_unit` / `price`，实测 500000 / 7.3。
 * 读不到就回落到默认值，**不抛错** —— 倍率读不到不该让整个看板挂掉，
 * 但金额可能差一点，所以返回值里带 `source` 让界面能说明来源。
 *
 * @param upstream - 上游会话（这个接口不需要 token）。
 * @returns `{quotaPerUnit, priceRatio, currency, displayType, source}`。
 */
async function readQuotaConfig(upstream) {
	try {
		const { status, json } = await upstream.request('/api/status');
		const d = json?.data;
		if (status !== 200 || d === undefined) throw new Error(`HTTP ${status}`);
		const unit = Number(d.quota_per_unit);
		const money = displayMoneyOf(d);
		return {
			quotaPerUnit: Number.isFinite(unit) && unit > 0 ? unit : FALLBACK_QUOTA_PER_UNIT,
			priceRatio: money.ratio,
			currency: money.currency,
			displayType: money.displayType,
			source: 'site',
		};
	} catch {
		return {
			quotaPerUnit: FALLBACK_QUOTA_PER_UNIT,
			priceRatio: 1,
			currency: 'USD',
			displayType: '',
			source: 'fallback',
		};
	}
}

/**
 * 面板「余额 / 消耗」到底用什么单位显示 —— 这里只做一件事：和面板对齐。
 *
 * new-api 前端的取法（web/src/lib/currency.ts 的 getDisplayMeta）：
 *   `quota_display_type` 是 USD → 汇率 1，符号 `$`；
 *   CNY → 汇率 `usd_exchange_rate`，符号 `¥`；
 *   CUSTOM → `custom_currency_exchange_rate` + 自定义符号。
 * ⚠️ `price`（=7.3）是「充值 1 美元要付多少钱」，**不是**显示汇率。
 *    旧实现拿 price 当汇率，于是官网显示 $6.62，这里却显示 ¥48.31，差额正好是 7.3 倍。
 *
 * @returns `{ratio, currency, displayType}` —— ratio 是「美元面值 → 显示单位」的乘数。
 */
function displayMoneyOf(d) {
	const rate = Number(d.usd_exchange_rate);
	const type = String(d.quota_display_type ?? '').toUpperCase();
	if (type === 'CNY') return { ratio: Number.isFinite(rate) && rate > 0 ? rate : 1, currency: 'CNY', displayType: type };
	if (type === 'CUSTOM') {
		const custom = Number(d.custom_currency_exchange_rate);
		return { ratio: Number.isFinite(custom) && custom > 0 ? custom : 1, currency: 'CUSTOM', displayType: type };
	}
	// USD（以及未知 / TOKENS）：面板按美元面值显示，倍率恒为 1。
	return { ratio: 1, currency: 'USD', displayType: type };
}

/**
 * 读**分组计费倍率**：`GET /api/pricing` 顶层的 `group_ratio`。
 *
 * ⚠️ 别去 `data` 里找 —— 那是逐模型价格表；`group_ratio` / `usable_group` 都在最外层。
 *
 * 返回：
 * ```
 * { groups: [ {group, ratio, note, source} … ], fetchedAt, source }
 * ```
 * `source`：`'site'`（实时）/ `'snapshot'`（本次没取到，用上次成功快照）/ `'unavailable'`。
 * 分组按倍率升序，`default` 若站点没给就补一条 ×1（New API 默认组就是这个值）。
 *
 * 失败**不抛错**：分组倍率只是看板的一块，拿不到不该让余额和用量一起挂掉。
 *
 * @param upstream - 上游会话。
 * @param fallback - 上次成功的快照（可为 undefined）。
 */
async function readGroupRatios(upstream, fallback) {
	const fallbackGroups = Array.isArray(fallback?.groupRatios?.groups)
		? fallback.groupRatios.groups.map((g) => ({ ...g, source: 'snapshot' }))
		: [];
	const snapshot = () => ({
		groups: fallbackGroups,
		fetchedAt: Number(fallback?.groupRatios?.fetchedAt) || 0,
		source: fallbackGroups.length > 0 ? 'snapshot' : 'unavailable',
	});
	try {
		const { status, json } = await upstream.request('/api/pricing');
		const raw = json?.group_ratio;
		if (status !== 200 || raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
			throw new Error(`HTTP ${status} / 缺少 group_ratio`);
		}
		const notes = json?.usable_group && typeof json.usable_group === 'object' ? json.usable_group : {};
		const groups = [];
		for (const [name, value] of Object.entries(raw)) {
			const ratio = Number(value);
			if (!Number.isFinite(ratio) || ratio < 0) continue;
			groups.push({
				group: String(name),
				ratio,
				note: String(notes[name] ?? ''),
				source: 'site',
			});
		}
		// `default` 是账号默认组，站点通常不列。补上，让「账户分组」那行也有倍率可显示。
		if (groups.length > 0 && !groups.some((g) => g.group === 'default')) {
			groups.push({ group: 'default', ratio: 1, note: String(notes.default ?? '') || 'User group', source: 'default' });
		}
		if (groups.length === 0) throw new Error('group_ratio 里没有有效分组');
		groups.sort((a, b) => a.ratio - b.ratio || a.group.localeCompare(b.group, 'zh'));
		return { groups, fetchedAt: Date.now(), source: 'site' };
	} catch (error) {
		diag('data', `分组倍率读取失败，回落快照：${String(error?.message ?? error)}`);
		return snapshot();
	}
}

/**
 * 抓一次全量数据。**单项失败不整体失败**：余额拿到了就显示余额，
 * 某个接口抽风只让对应那块报错，别让整页变成一片红。
 *
 * @param upstream - 已登录的上游会话。
 * @param options - `{rangeDays, quotaPerUnit, priceRatio, groupRatios}`。
 * @returns 数据对象 + `partial`（哪些块失败了）。
 */
async function collectAll(upstream, { rangeDays = 30, quotaPerUnit, priceRatio, currency, displayType, groupRatios }) {
	const startTimestamp = daysAgoEpoch(rangeDays);
	const endTimestamp = Math.floor(Date.now() / 1000);
	const errors = [];
	/** 单个请求失败就记一条并返回 undefined。 */
	const soft = async (label, fn) => {
		try {
			return await fn();
		} catch (error) {
			errors.push({ part: label, message: String(error?.message ?? error) });
			return undefined;
		}
	};

	// ⚠️ `/api/data/self` **必须**带时间参数，否则返回空数组。
	// ⚠️ 不再拉 `/api/log/self`：界面上「最近调用」整栏已删除。
	//    少打一次上游、少传 100 条记录，既能省请求也让页面快一点。
	const [self, quotaRaw, tokens, topups] = await Promise.all([
		soft('账户信息', () => upstream.get('/api/user/self')),
		soft('按天用量', () =>
			upstream.get(`/api/data/self?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}`),
		),
		// ⚠️ 尾部斜杠不能少：`/api/token` 会 404，`/api/token/` 才对。
		soft('API 令牌', () => upstream.list('/api/token/', { p: 1, pageSize: TOKEN_PAGE_SIZE })),
		soft('充值记录', () => upstream.list('/api/user/topup/self', { p: 1, pageSize: 20 })),
	]);

	// 账户信息都没有 ⇒ 这次抓取没有意义，抛出去让上层报错（而不是显示一堆空块）。
	if (self === undefined) {
		const first = errors.find((e) => e.part === '账户信息');
		throw new UpstreamError(first?.message ?? '无法读取账户信息', 0, 'data');
	}

	// 曲线粒度跟着范围走，并且**一律补齐空格子**（上游只回有用量的时段，
	// 不补的话图会缺几根，看着像被截断）：
	//   1 天  → 24 个整点格
	//   7 天  → 14 个 12 小时格（168 根小时柱手机上看不了，7 根天柱又太粗）
	//   其它  → 按天
	// ⚠️ `usage.days` 最终只装**补零后的时间格子**（键形如 `MM-DD HH:00`），
	//    所以「今日」「范围内合计」都必须从**原始按天聚合**里取，不能去 days 里 find。
	const bucket = rangeDays <= 1 ? 'hour' : rangeDays <= 7 ? 'half' : 'day';
	const usage = shapeQuotaData(quotaRaw, quotaPerUnit, bucket);
	/** 原始按天聚合：键是纯日期，「今日」只认它。 */
	const byDayRows = shapeQuotaData(quotaRaw, quotaPerUnit, 'day').days;
	if (bucket === 'hour') usage.days = fillHourBuckets(usage.days);
	if (bucket === 'half') usage.days = fillHalfDayBuckets(usage.days);
	usage.bucket = bucket;
	/** 今天的日期键。 */
	const todayKey = localDay(Math.floor(Date.now() / 1000));
	usage.today = sumRows(byDayRows.filter((d) => d.day === todayKey));

	return {
		fetchedAt: Date.now(),
		rangeDays,
		quotaPerUnit,
		priceRatio,
		/** 显示单位：`USD` / `CNY` / `CUSTOM`，跟面板保持一致。 */
		currency,
		displayType,
		user: shapeUser(self, quotaPerUnit, priceRatio),
		usage: {
			...usage,
		},
		tokens: (tokens?.items ?? []).map((r) => shapeToken(r, quotaPerUnit)).filter(Boolean),
		topups: (topups?.items ?? []).map((r) => shapeTopup(r, quotaPerUnit)).filter(Boolean),
		/** 分组计费倍率（与 quota/$ 换算倍率无关），拿不到时是空数组 + source:'unavailable'。 */
		groupRatios: groupRatios ?? { groups: [], fetchedAt: 0, source: 'unavailable' },
		partial: errors,
		/**
		 * **原始明细留一份**：切 1 天 / 7 天 / 30 天时靠它本地重新聚合，
		 * 不用再打上游、更不用再登录一次。放最后，界面不会读它。
		 */
		rawRows: Array.isArray(quotaRaw) ? quotaRaw : [],
	};
}

/** 天数 → 曲线粒度：1 天=24 整点格，≤7 天=14 个半天格，再往上按天。 */
function bucketForDays(rangeDays) {
	return rangeDays <= 1 ? 'hour' : rangeDays <= 7 ? 'half' : 'day';
}

/**
 * 从「已拉满 {@link FETCH_DAYS} 天」的数据里，**只取用户要的那一段**重新聚合。
 *
 * ⚠️ 这是省钱/省登录的关键：界面切档不走网络，纯本地计算。
 *    `/api/data/self` 一次拉回来的就是 30 天明细，1 天和 7 天本来就是它的子集，
 *    所以这里裁剪不会丢数据，也不会让「今日消耗」之类的统计失真。
 *
 * @param data - {@link collectAll} 的产物（含 `rawRows`）。
 * @param rangeDays - 用户要的回看天数（1..365）。
 * @param extra - 要合并进结果的额外字段（`cached` / `ageMs`）。
 * @returns 新对象，`usage` 已按 `rangeDays` 重算。
 */
function withRange(data, rangeDays, extra) {
	const rows = Array.isArray(data.rawRows) ? data.rawRows : [];
	// started 之后才算数。留一点余量（-1 小时）避免整点边界抖动。
	const sinceEpoch = daysAgoEpoch(rangeDays) - 3600;
	const scoped = rows.filter((row) => {
		const at = Number(row?.created_at);
		return Number.isFinite(at) === false || at >= sinceEpoch;
	});

	const bucket = bucketForDays(rangeDays);
	const usage = shapeQuotaData(scoped, data.quotaPerUnit, bucket);
	const byDayRows = shapeQuotaData(scoped, data.quotaPerUnit, 'day').days;
	if (bucket === 'hour') usage.days = fillHourBuckets(usage.days);
	if (bucket === 'half') usage.days = fillHalfDayBuckets(usage.days);
	usage.bucket = bucket;
	const todayKey = localDay(Math.floor(Date.now() / 1000));
	usage.today = sumRows(byDayRows.filter((d) => d.day === todayKey));

	return { ...data, ...extra, rangeDays, usage };
}

// ─────────────────────────────── 取数据（缓存层） ───────────────────────────────

/**
 * 进程内缓存：凭据指纹 → `{data, at}`。改密码会换指纹，自然失效。
 *
 * ⚠️ key 里**故意不含天数**：一份 30 天数据服务所有档位，切档纯本地重算。
 *    带天数的话切一次档就整轮重拉 + 重登一次，会撞站点的会话上限。
 */
const cache = new Map();

/**
 * 拿一份数据：**先用缓存，缓存过期或没有才打上游**。
 *
 * @param p - 路径集合。
 * @param options - `{force, rangeDays}`。
 * @returns 数据对象（带 `cached` / `ageMs`）。
 */
async function loadData(p, { force = false, rangeDays = 30 } = {}) {
	const credentials = readCredentials(p);
	if (credentials === undefined) {
		throw new UpstreamError('还没有配置系统访问令牌', 0, 'no-credentials');
	}
	// ⚠️ 缓存 key **不带天数**：一次拉满 {@link FETCH_DAYS} 天，三档共用这一份。
	//    见 FETCH_DAYS 的说明 —— 带上天数就会让切档变成「重新拉一次」。
	const fingerprint = `token\u0000${credentials.accessToken}`;
	const cached = cache.get(fingerprint);
	const now = Date.now();
	if (!force && cached !== undefined && now - cached.at < CACHE_TTL_MS) {
		return withRange(cached.data, rangeDays, { cached: true, ageMs: now - cached.at });
	}

	// 先挑一个能连上的站点（官方给的那几个域名的线路优化不一样）。
	const site = await resolveSite();
	const upstream = new Upstream(credentials.accessToken, site);
	// 倍率（quota/$）与分组计费倍率都先读，拿到再整形数据。
	// 分组倍率失败时会回落「上次成功快照」，所以快照要在 data 之前读好。
	const fallback = await readSnapshot(p);
	const config = await readQuotaConfig(upstream);
	const groupRatios = await readGroupRatios(upstream, fallback);
	const data = await collectAll(upstream, {
		rangeDays: FETCH_DAYS,
		quotaPerUnit: config.quotaPerUnit,
		priceRatio: config.priceRatio,
		currency: config.currency,
		displayType: config.displayType,
		groupRatios,
	});
	data.quotaSource = config.source;
	data.site = upstream.site;
	cache.clear();
	cache.set(fingerprint, { data, at: now });

	// 落一份「上次成功」快照：站点挂了时界面还能说明「上次什么时候、是什么数」。
	await fsp.mkdir(p.dir, { recursive: true, mode: 0o700 }).catch(() => {});
	await fsp.writeFile(p.cache, JSON.stringify(data), { mode: 0o600 }).catch(() => {});

	return withRange(data, rangeDays, { cached: false, ageMs: 0 });
}

/** 读「上次成功」快照。没有就 undefined。 */
async function readSnapshot(p) {
	try {
		return JSON.parse(await fsp.readFile(p.cache, 'utf8'));
	} catch {
		return undefined;
	}
}

// ─────────────────────────────── HTTP 闸门与工具 ───────────────────────────────

/**
 * 引擎给页面用的那把门：查 Host 是否 loopback + 会话 cookie。
 * 页面自己的 fetch 天然带 cookie，所以对正常界面完全透明。
 *
 * 取不到服务（启动中 / 重载中）一律 **503 fail-closed**，绝不降级。
 */
function gateRejection(ctx, req) {
	const connection = ctx.get?.('connection');
	if (connection === undefined || typeof connection.requestRejection !== 'function') {
		if (!gateWarned) {
			gateWarned = true;
			ctx.logger?.warn?.('[dsh-linksub-usage] connection 服务尚未就绪，接口一律 503（fail-closed）');
		}
		return 503;
	}
	try {
		return connection.requestRejection(req);
	} catch (error) {
		ctx.logger?.warn?.(
			`[dsh-linksub-usage] requestRejection 抛错，接口一律 503：${String(error?.message ?? error)}`,
		);
		return 503;
	}
}

/** 统一的 JSON 响应。`no-store`：余额是实时事实，不能让浏览器缓存。 */
function sendJson(res, status, payload) {
	const body = JSON.stringify(payload);
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store',
		'content-length': Buffer.byteLength(body),
	});
	res.end(body);
}

/** 读完整个请求体（上限 8 KB；这里只会收到账号密码，超过就是攻击）。 */
function readBody(req, limit = 8 * 1024) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		req.on('data', (chunk) => {
			size += chunk.length;
			if (size > limit) {
				reject(new Error('请求体过大'));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

/**
 * 令牌脱敏：只露前 4 后 4，够确认「连的是哪一串」，又不至于泄露整串。
 *
 * @param token - 系统访问令牌。
 * @returns 形如 `nap_…Mw2f` 的短串（太短就整串打码）。
 */
function maskToken(token) {
	const s = String(token);
	if (s.length <= 8) return '****';
	return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

/** `days` 查询参数 → 1..365，非法或缺失时 30。 */
function clampDays(raw) {
	const n = Number(raw);
	if (Number.isFinite(n) === false) return 30;
	return Math.min(365, Math.max(1, Math.round(n)));
}

/**
 * 挂载 `/api/dsh-linksub` 下的全部子路由。
 *
 * 子路由：
 * - `GET  /status` —— 有没有配凭据 + 上次成功的快照（不联网，秒回）
 * - `GET  /data`   —— 全量数据（`?force=1` 跳过缓存，`?days=N` 回看天数）
 * - `GET  /diag`   —— 最近若干行诊断日志（前端「诊断」按钮读它）
 * - `POST /diag`   —— 前端把「点了什么 / 耗时 / 失败原因」上报进来（同一份日志）
 * - `POST /token`      —— `{accessToken}` 保存系统访问令牌并立即验证一次
 * - `POST /disconnect` —— 清除令牌与快照
 *
 * @param ctx - Cordis 上下文。
 */
export function apply(ctx) {
	const p = paths();
	if (p === undefined) {
		ctx.logger?.warn?.('[dsh-linksub-usage] DSH_HOME 未设置，插件不注册');
		return;
	}

	// 每次启动落一行：下次排查时先看「引擎是不是重启过、几点重启的」。
	diag('host', `插件已挂载 ${ROUTE_PREFIX}（pid=${process.pid}，node=${process.version}）`);

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: 'prefix',
				path: ROUTE_PREFIX,
				handler: async (req, res) => {
					// ⚠️ 门在最前面，方法判定在门之后：否则 405 本身就是一个存在性信号。
					const rejected = gateRejection(ctx, req);
					if (rejected !== undefined) {
						sendJson(res, rejected, { ok: false, error: 'rejected', status: rejected });
						return;
					}

					const url = new URL(String(req.url ?? '/'), 'http://localhost');
					const sub = url.pathname.slice(ROUTE_PREFIX.length) || '/';
					const method = String(req.method ?? 'GET').toUpperCase();

					try {
						if (sub === '/status') {
							if (method !== 'GET' && method !== 'HEAD') return sendJson(res, 405, { ok: false, error: 'method' });
							const credentials = readCredentials(p);
							const snapshot = credentials === undefined ? undefined : await readSnapshot(p);
							return sendJson(res, 200, {
								ok: true,
								configured: credentials !== undefined,
								/**
								 * 只露令牌前 4 后 4：够确认连的是哪一串，又不泄露整串。
								 */
								tokenHint: credentials === undefined ? '' : maskToken(credentials.accessToken),
								/**
								 * 现在只有一种鉴权方式（系统访问令牌）。
								 * 留着这个字段是为了认得出「没配」和「配了」，前端与旧快照都不受影响。
								 */
								authMode: credentials === undefined ? 'none' : 'token',
								site: preferredSite ?? DEFAULT_SITE,
								snapshot,
							});
						}

						if (sub === '/data') {
							if (method !== 'GET' && method !== 'HEAD') return sendJson(res, 405, { ok: false, error: 'method' });
							const force = url.searchParams.get('force') === '1';
							const rangeDays = clampDays(url.searchParams.get('days'));
							// ⚠️ 这两个时间点是这套诊断的全部意义所在：
							//    `host` = 宿主半从进来到返回（含上游往返），`total` = 前端看到的墙钟。
							//    两者都记，才能分清「是上游慢」还是「引擎/前端慢」。
							const startedAt = Date.now();
							diag('data', `请求 days=${rangeDays} force=${force ? 1 : 0}`);
							const data = await loadData(p, { force, rangeDays });
							const ms = Date.now() - startedAt;
							diag(
								'data',
								`返回 ${ms}ms days=${rangeDays} cached=${data.cached ? 1 : 0} bucket=${data.usage?.bucket} 格=${data.usage?.days?.length} 数据时间=${new Date(data.fetchedAt).toISOString()}`,
							);
							return sendJson(res, 200, { ok: true, data });
						}

						// ── 诊断日志 ──
						// GET：取最近若干行（界面的「诊断」按钮读它）。
						// POST：前端把「点了什么 / 请求花了多久 / 失败原因」上报进来，
						//       和宿主半的行写进同一个文件 —— 页面一刷新前端内存就没了，
						//       只有落到宿主这边才留得住。
						if (sub === '/diag') {
							if (method === 'GET' || method === 'HEAD') {
								const want = Math.min(DIAG_MEM_MAX, Math.max(1, Number(url.searchParams.get('lines')) || 120));
								return sendJson(res, 200, {
									ok: true,
									file: p.diag,
									lines: diagLines.slice(-want),
								});
							}
							if (method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method' });
							let body;
							try {
								body = JSON.parse((await readBody(req, 16 * 1024)) || '{}');
							} catch {
								return sendJson(res, 400, { ok: false, error: 'bad-json' });
							}
							const tag = String(body?.tag ?? 'web').slice(0, 16);
							const text = String(body?.text ?? '').slice(0, 400);
							if (text !== '') diag(tag, text);
							return sendJson(res, 200, { ok: true });
						}

						if (sub === '/token') {
							if (method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method' });
							const raw = await readBody(req);
							let body;
							try {
								body = JSON.parse(raw === '' ? '{}' : raw);
							} catch {
								return sendJson(res, 400, { ok: false, error: 'bad-json' });
							}
							const accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';
							if (accessToken === '') {
								return sendJson(res, 400, { ok: false, error: 'empty', message: '系统访问令牌不能为空' });
							}
							// **先验证再落盘**：令牌打错时不该把错的写进文件，否则看板每次刷新
							// 都要白撞一次 401。校验就是一次 `GET /api/user/self`。
							const probe = new Upstream(accessToken, await resolveSite());
							let status = 0;
							let json;
							try {
								({ status, json } = await probe.request('/api/user/self'));
							} catch (error) {
								// 网络层失败（超时 / 连不上）：不是令牌的错，别报 401 让人以为令牌填错了。
								return sendJson(res, 502, {
									ok: false,
									error: error?.kind ?? 'upstream',
									message: String(error?.message ?? error),
								});
							}
							if (status === 401 || json?.success !== true) {
								return sendJson(res, 401, {
									ok: false,
									error: 'login',
									message: describeTokenFailure(status, json),
								});
							}
							await writeCredentials(p, { accessToken });
							cache.clear();
							ctx.logger?.info?.('[dsh-linksub-usage] 已保存系统访问令牌并验证通过');
							return sendJson(res, 200, { ok: true, tokenHint: maskToken(accessToken) });
						}

						if (sub === '/disconnect') {
							if (method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method' });
							await deleteCredentials(p);
							cache.clear();
							return sendJson(res, 200, { ok: true });
						}

						return sendJson(res, 404, { ok: false, error: 'not-found' });
					} catch (error) {
						const status = error instanceof UpstreamError && error.status >= 400 ? 502 : 500;
						diag('error', `${sub} 失败(${error?.kind ?? 'internal'}/${status})：${String(error?.message ?? error)}`);
						ctx.logger?.warn?.(`[dsh-linksub-usage] ${sub} 失败：${String(error?.message ?? error)}`);
						return sendJson(res, status, {
							ok: false,
							error: error?.kind ?? 'internal',
							message: String(error?.message ?? error),
						});
					}
				},
			}),
		`dsh-linksub-usage: 挂载 ${ROUTE_PREFIX}`,
	);
}
