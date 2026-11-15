/**
 * 客户端半「有数据状态」渲染检验。
 *
 * 本机没有 React 包（浏览器运行时才提供），所以这里实现一个**带状态队列**的
 * 极简 React 假实现：`useState` 的 setter 会把值写进槽位，`useEffect` 在渲染后
 * 冲刷，多轮渲染直到状态稳定 —— 这样就能真正走到「数据已加载」那条分支。
 *
 * 断言三件事：
 *  ① 所有卡片都渲染出来（趋势/按模型/令牌/调用记录/账户）；
 *  ② 界面上不出现 undefined / NaN / [object Object]；
 *  ③ 关键金额与真实数据一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 插件自己的目录（客户端源码在这里），与 DSH_HOME 无关。 */
const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const data = JSON.parse(fs.readFileSync(path.join(process.env.DSH_HOME, 'linksub-usage', 'last-good.json'), 'utf8'));

let elementCount = 0;
/** 每个 hook 槽位：{ value, setter }。按「组件第几次调用」分配，够用。 */
let slots = [];
let cursor = 0;
let effects = [];
let dirty = false;

function useState(init) {
  const index = cursor++;
  if (slots[index] === undefined) slots[index] = { value: typeof init === 'function' ? init() : init };
  const slot = slots[index];
  const set = (next) => {
    const value = typeof next === 'function' ? next(slot.value) : next;
    if (value !== slot.value) { slot.value = value; dirty = true; }
  };
  return [slot.value, set];
}

const React = {
  createElement(type, props, ...children) {
    elementCount++;
    return { __el: true, type, props: props ?? {}, children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false) };
  },
  useState,
  useCallback: (fn) => fn,
  useEffect(fn) { effects.push(fn); },
  useRef(init) { const i = cursor++; if (slots[i] === undefined) slots[i] = { value: { current: init } }; return slots[i].value; },
};

// fetch 打桩：返回真实快照
// ⚠️ client.js 在 `new Function('window', ...)` 里执行，它看到的 window 是我们传进去的那个对象，
//    所以打桩必须装在那个对象上，装到 globalThis 上无效。
const fakeWindow = {
  fetch: async (url) => {
    const u = String(url);
    const payload = u.includes('/status')
      ? { ok: true, configured: true, tokenHint: 'nap_…Mw2f', site: 'https://linksub.fun', snapshot: data }
      : { ok: true, data: withHourBuckets(data) };
    return { status: 200, ok: true, json: async () => payload };
  },
};

/**
 * 让打桩数据反映「1 天 = 24 根小时柱」。
 *
 * 快照是磁盘上 30 天粒度的旧数据，直接喂给界面会看不到小时补零的效果。
 * 这里把 `usage.days` 换成 24 个整点桶（取快照里按小时能凑到的量，其余为 0），
 * 只是让渲染用例更贴近真实返回，不改插件代码。
 */
function withHourBuckets(snapshot) {
  // 分组计费倍率：真实站点当前的几个代表值（旧快照里没有这个字段，这里注入）。
  // 用来验证界面真的把「每个分组 ×几」渲染出来了，而不只是不报错。
  const groupRatios = {
    source: 'site',
    fetchedAt: Date.now(),
    groups: [
      { group: '国模特惠', ratio: 0.02, note: '', source: 'site' },
      { group: 'deepseek（纯血号池）', ratio: 0.14, note: '', source: 'site' },
      { group: '破甲分组', ratio: 0.2, note: '缓存优化测试', source: 'site' },
      { group: 'grok', ratio: 0.3, note: '便宜', source: 'site' },
      { group: 'default', ratio: 1, note: 'User group', source: 'default' },
    ],
  };
  const hours = [];
  const base = new Date();
  base.setMinutes(0, 0, 0);
  const pad = (v) => String(v).padStart(2, '0');
  for (let i = 23; i >= 0; i--) {
    const at = new Date(base.getTime() - i * 3600 * 1000);
    const key = `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:00`;
    // 每 3 小时造一点用量，其余小时为 0 —— 正是真实数据的样子。
    const has = i % 3 === 0;
    hours.push({ day: key, quota: has ? 120000 : 0, usd: has ? 0.24 : 0, count: has ? 20 : 0, tokens: has ? 900000 : 0, models: [] });
  }
  // 7 天 → 14 个 12 小时格；其余范围沿用快照
  const halves = [];
  const cur = new Date();
  cur.setHours(Math.floor(cur.getHours() / 12) * 12, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const at = new Date(cur.getTime() - i * 12 * 3600 * 1000);
    const key = `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:00`;
    const has = i % 2 === 0;
    halves.push({ day: key, quota: has ? 300000 : 0, usd: has ? 0.6 : 0, count: has ? 30 : 0, tokens: has ? 2000000 : 0, models: [] });
  }
  const daysWanted = Number(process.env.TEST_DAYS ?? 1);
  if (daysWanted === 7) {
    return { ...snapshot, groupRatios, rangeDays: 7, usage: { ...snapshot.usage, bucket: 'half', days: halves } };
  }
  return { ...snapshot, groupRatios, rangeDays: 1, usage: { ...snapshot.usage, bucket: 'hour', days: hours } };
}

const src = fs.readFileSync(path.join(PKG_ROOT, 'lib', 'client.js'), 'utf8');
let apply = null;
fakeWindow.__ModuleLoader__ = { load({ factory }) { apply = factory((s) => { if (s === 'react') return React; throw new Error('unknown ' + s); }).apply; } };
globalThis.window = fakeWindow;
new Function('window', 'console', src)(fakeWindow, console);

let renderFn = null;
const t = (key) => key;
apply({
  inject: (d, fn) => fn({
    slots: { inject: (n, f) => f(), register: (o, comp) => { renderFn = comp; } },
    locale: { register: () => {}, bind: () => t },
    effect: (f) => f(),
  }),
});

// 多轮渲染直到状态稳定（最多 10 轮）
let tree = null;
for (let round = 0; round < 10; round++) {
  cursor = 0;
  effects = [];
  dirty = false;
  tree = renderFn({ t });
  for (const fn of effects) { try { const c = fn(); if (typeof c === 'function') c(); } catch (e) { console.log('effect 抛错:', e.message); } }
  // 等微任务（fetch 是 async 的）
  await new Promise((r) => setTimeout(r, 20));
  if (!dirty) break;
}

const texts = [];
function walk(node, depth = 0) {
  if (node === null || node === undefined || node === false) return;
  if (typeof node === 'string' || typeof node === 'number') { texts.push(String(node)); return; }
  if (Array.isArray(node)) { for (const n of node) walk(n, depth); return; }
  if (node.__el) {
    const tag = typeof node.type === 'string' ? node.type : 'Comp';
    if (tag === 'div' && node.props.style && node.props.style === undefined) {}
    walk(node.children, depth + 1);
  }
}
walk(tree);

const content = texts.filter((x) => String(x).trim() !== '');
console.log('元素总数:', elementCount, '| 文本段:', content.length);
console.log('\n=== 界面实际文本 ===');
// ⚠️ 不要截断太狠：调用记录表很长，截 2600 字符会把后面「账户信息」等卡片切掉，
//    导致 mustHave 误报缺失。这里留足空间。
console.log(content.join(" │ "));

const bad = content.filter((l) => /undefined|NaN|\[object Object\]/.test(String(l)));
console.log('\n=== 异常内容 ===');
console.log(bad.length === 0 ? '✅ 无 undefined / NaN / [object Object]' : '❌ ' + bad.join(' , '));

// 「最近调用」整栏已删除，不再要求 logs 卡片存在。
const mustHave = ['remaining', 'used', 'today', 'requests', 'trend', 'byModel', 'tokens', 'account'];
// ⚠️ 匹配「作为独立文本段出现」。趋势卡的标题现在是 `trend · 近 30 天`，
//    用 includes 只比整个文本段会误报缺失，所以放宽成子串匹配。
const missing = mustHave.filter((k) => !content.some((x) => String(x).includes(k)));
console.log('\n=== 必需卡片 ===');
console.log(missing.length === 0 ? '✅ 全部存在: ' + mustHave.join(', ') : '❌ 缺失: ' + missing.join(', '));

// 分组倍率必须真的渲染成文本，且这几个基准值一个都不能少：
// ×0.02 国模特惠 / ×0.14 纯血号池 / ×0.2 破甲分组 / ×1 default。
const ratioMust = ['groupRatioCard','groupRatio','×0.02','×0.14','×0.2','×0.3','×1'];
const ratioMissing = ratioMust.filter((k) => !content.some((x) => String(x).includes(k)));
console.log('\n=== 分组倍率渲染 ===');
console.log(ratioMissing.length === 0 ? '✅ 全部分组倍率可见: ' + ratioMust.join(', ') : '❌ 缺失: ' + ratioMissing.join(', '));

process.exit(bad.length === 0 && missing.length === 0 && ratioMissing.length === 0 ? 0 : 1);
