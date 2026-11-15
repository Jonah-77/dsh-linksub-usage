/**
 * 真实账号全流程检验：直接跑插件本体，走「校验令牌 → 抓全量」。
 * 跑法：LS_TOKEN=<系统访问令牌> node test/live-check.mjs
 * 只打印摘要，不打印任何密码或令牌。
 */
process.env.DSH_HOME = process.env.DSH_HOME || '/data/user/0/com.dsh.android/files/home/.dsh';
const plugin = await import('../lib/index.js');

const routes = [];
const ctx = {
  webServer: { register: (r) => { routes.push(r); return () => {}; } },
  get: () => ({ requestRejection: () => undefined }),
  effect: (fn) => fn(),
  logger: { info: (...a) => console.log('[info]', ...a), warn: (...a) => console.log('[warn]', ...a) },
};
plugin.apply(ctx);
console.log('路由已挂载:', routes[0]?.path);

// 直接用插件的内部逻辑：通过 HTTP handler 模拟一次登录 + 一次抓取
const { Readable } = await import('node:stream');
async function call(path, { method = 'GET', body } = {}) {
  const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
  let sent = false;
  const req = Object.assign(new Readable({ read() { if (sent) { this.push(null); return; } sent = true; this.push(bytes); this.push(null); } }), { method, url: '/api/dsh-linksub' + path, headers: {} });
  let status = 0, json;
  const res = { writeHead: (c) => { status = c; return res; }, end: (t) => { json = t === undefined ? undefined : JSON.parse(t); } };
  await routes[0].handler(req, res);
  return { status, json };
}

/** 令牌从环境变量拿：`LS_TOKEN=... node test/live-check.mjs` */
const saved = await call('/token', { method: 'POST', body: { accessToken: process.env.LS_TOKEN } });
console.log('令牌校验:', saved.status, JSON.stringify(saved.json));

if (saved.json?.ok) {
  const t0 = Date.now();
  const r = await call('/data?force=1&days=30');
  console.log('抓取耗时:', Date.now() - t0, 'ms | HTTP', r.status);
  if (!r.json?.ok) { console.log('失败:', JSON.stringify(r.json)); process.exit(1); }
  const d = r.json.data, u = d.user;
  console.log('\n=== 账户 ===');
  console.log(' 显示名:', u.displayName, '| 状态:', u.status, '| 分组:', u.group);
  console.log(' 剩余:', u.remainingQuota, 'quota = $' + u.remainingUsd.toFixed(4), '≈ ¥' + u.remainingCny.toFixed(2));
  console.log(' 已用:', u.usedQuota, 'quota = $' + u.usedUsd.toFixed(4));
  console.log(' 历史总额:', '$' + u.totalUsd.toFixed(4), '| 请求数:', u.requestCount);
  console.log(' 倍率来源:', d.quotaSource, '| quotaPerUnit:', d.quotaPerUnit, '| price:', d.priceRatio);
  console.log(' 分组倍率(', d.groupRatios?.source, '):', (d.groupRatios?.groups ?? []).map(g => `${g.group}×${g.ratio}`).join(' '));
  console.log('\n=== 用量 ===');
  console.log(' 天数:', d.usage.days.length, '| 30天合计: $' + d.usage.totalUsd.toFixed(4), '| 次数:', d.usage.totalCount, '| tokens:', d.usage.totalTokens);
  console.log(' 今日:', d.usage.today.day, '$' + d.usage.today.usd.toFixed(4), d.usage.today.count, '次');
  console.log(' 近5天:', d.usage.days.slice(-5).map(x => `${x.day}=$${x.usd.toFixed(3)}`).join(' '));
  console.log(' 模型TOP5:', d.usage.models.slice(0,5).map(m => `${m.model}=$${m.usd.toFixed(3)}`).join(' '));
  console.log('\n=== 记录 ===');
  console.log(' 令牌:', d.tokens.length, '个 →', d.tokens.map(t => `${t.name}(status=${t.status},已用$${t.usedUsd.toFixed(3)}${t.unlimited?',无限':''})`).join(' '));
  console.log(' 充值:', d.topups.length, '条');
  console.log(' partial:', JSON.stringify(d.partial));
  console.log('\n=== 令牌字段抽查 ===');
  console.log(JSON.stringify(d.tokens[0], null, 1));
}
