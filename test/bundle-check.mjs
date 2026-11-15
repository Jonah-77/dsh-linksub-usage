/**
 * 验证本包能被 DSH 当作「组合包（bundle）」加载：
 *  ① package.json 里有 dsh.bundle.patch；
 *  ② 那个 patch 文件能解析，且形如 [{insert:[{id,name}]}]；
 *  ③ name 指向的 lib/index.js 真实存在、能 import、导出 apply；
 *  ④ dsh.client 声明合法，client.js 存在且能被模块加载器挂上。
 */
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
/** 本包根目录（test/ 的上一级）——Windows 上它经软链挂在 <profile>/node_modules/ 下。 */
const selfDir = fileURLToPath(new URL('..', import.meta.url));
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
const ENGINE = ENGINE_NODE_MODULES;
const yaml = (await import(pathToFileURL(path.join(ENGINE, 'js-yaml/index.js')).href)).default;

// 手机上插件整包落在 $DSH_HOME/linksub-usage；Windows 上它是 <profile>/node_modules 里的包，直接验自身。
const homeCopy = process.env.DSH_HOME + '/linksub-usage';
const dir = fs.existsSync(path.join(homeCopy, 'package.json')) ? homeCopy : selfDir;
const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));

assert.ok(pkg.dsh?.bundle?.patch, '缺少 dsh.bundle.patch');
console.log('✓ dsh.bundle.patch =', pkg.dsh.bundle.patch);

const patchPath = path.join(dir, pkg.dsh.bundle.patch);
assert.ok(fs.existsSync(patchPath), 'patch 文件不存在: ' + patchPath);
const patches = yaml.load(fs.readFileSync(patchPath, 'utf8'));
console.log('✓ patch 解析成功:', JSON.stringify(patches));

assert.ok(Array.isArray(patches) && patches.length > 0, 'patch 必须是非空数组');
const inserts = patches.flatMap((layer) => layer.insert ?? []);
assert.ok(inserts.length === 1, '应当恰好有一条 insert 规则');
const rule = inserts[0];
assert.equal(rule.id, 'linksub-usage');
// 显式 HTTP 头（手机上原本用账号密码登录，现在只认系统访问令牌）——注意这条断言在 e2e 里，此处只验挂载。
assert.ok(rule.name.startsWith('file://') || /^[@a-z0-9._/-]+$/i.test(rule.name), 'name 应为 file:// 绝对路径或裸包名');
console.log('✓ insert 规则:', rule.id, '→', rule.name);

// 手机形态：file:// 绝对路径；Windows 形态：裸包名，交给 createRequire 从 <profile>/node_modules 解析。
const entry = rule.name.startsWith('file://') ? rule.name.slice('file://'.length) : require.resolve(rule.name);
assert.ok(fs.existsSync(entry), '入口文件不存在: ' + entry);
const mod = await import(pathToFileURL(entry).href);
assert.equal(mod.name, 'dsh-linksub-usage');
assert.equal(typeof mod.apply, 'function');
console.log('✓ 入口可 import，name/apply 正确');

assert.equal(pkg.dsh.client.platform, 'web', 'dsh.client.platform 应为 web');
assert.ok(Array.isArray(pkg.dsh.client.inject), 'dsh.client.inject 应为数组');
const clientPath = path.join(dir, pkg.exports['./client'].default);
assert.ok(fs.existsSync(clientPath), 'client.js 不存在');
const clientSrc = fs.readFileSync(clientPath, 'utf8');
assert.ok(clientSrc.includes('__ModuleLoader__.load'), 'client.js 必须用 __ModuleLoader__.load 包裹');
assert.ok(clientSrc.includes('id: "dsh-linksub-usage"'), 'client.js 的 id 必须与包名一致');
console.log('✓ client.js 结构正确（ModuleLoader 包裹 + id 一致）');

console.log('\nBUNDLE_OK: 这个包现在能被 DSH 当组合包加载');
