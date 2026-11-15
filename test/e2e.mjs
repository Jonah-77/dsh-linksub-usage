/**
 * 宿主半端到端自测（离线）。模拟服务器复刻**实测确认过的**真实响应形态：
 *  - 鉴权**只有一种**：Authorization: Bearer <系统访问令牌>，缺了或不等于那串一律 401
 *  - 插件**不发任何登录请求**（站点的 POST /api/user/login 已被人机验证挡住）
 *  - /api/data/self 不带时间参数返回空数组
 *  - /api/token 无尾斜杠 404，/api/token/ 才对
 *  - 分页是 {success, data:{page,page_size,total,items}}
 *
 * 跑法：node test/e2e.mjs
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
// Windows 上传进来的绝对路径（D:\…）不能直接 import，必须转成 file:// URL。
const CORDIS = pathToFileURL(path.join(ENGINE_NODE_MODULES, '@deepseek-ai/cordis/lib/index.js')).href;
const TMP_HOME = path.join(os.tmpdir(), 'linksub-test-' + process.pid);
process.env.DSH_HOME = TMP_HOME;
/** 回退链里的所有域名，测试里一律指向本地模拟服务器。 */
const SITE_HOSTS = ['https://linksub.fun', 'https://api.linksub.fun', 'http://api.linksub.fun'];

const TOKEN = 'nap_fake_token_for_offline_test_only';
/** 脱敏后应该长这样：前 4 + … + 后 4。 */
const TOKEN_HINT = TOKEN.slice(0, 4) + '…' + TOKEN.slice(-4);
const calls = [];
let rejectAuth = false, breakTopups = false, breakPricing = false;
const dataQueries = [];
const now = Math.floor(Date.now() / 1000);
const todayLocal = (() => { const d = new Date(); d.setHours(0,0,0,0); return Math.floor(d.getTime()/1000); })();

const upstream = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  calls.push({ method: req.method, path: url.pathname, auth: req.headers.authorization ?? '' });
  const send = (s, p) => { res.writeHead(s, {'content-type':'application/json'}); res.end(JSON.stringify(p)); };

  // 面板按 USD 显示：汇率 1，price=7.3 只是「充值 1 美元付多少人民币」，不参与余额换算。
  if (url.pathname === '/api/status') return send(200,{success:true,data:{quota_per_unit:500000,price:7.3,display_in_currency:true,quota_display_type:'USD',usd_exchange_rate:1}});

  if (rejectAuth || req.headers.authorization !== 'Bearer ' + TOKEN)
    return send(401,{code:'AUTH_UNAUTHORIZED',message:'Unauthorized, invalid access token',success:false});

  if (url.pathname === '/api/user/self') return send(200,{success:true,data:{
    id:983,username:'demo',display_name:'Demo User',role:1,status:1,email:'demo@example.com',group:'default',
    quota:3338326,used_quota:1161674,request_count:1649,aff_quota:0,aff_history_quota:0,aff_count:0,aff_code:'KxrE',has_password:true}});

  if (url.pathname === '/api/data/self') {
    dataQueries.push(url.search);
    if (!url.searchParams.has('start_timestamp')) return send(200,{success:true,data:[]});
    return send(200,{success:true,data:[
      {model_name:'deepseek-v4.1-flash',created_at:todayLocal+3600,quota:50000,count:4,token_used:8000},
      {model_name:'gpt-5',created_at:todayLocal+7200,quota:150000,count:1,token_used:3000},
      {model_name:'deepseek-v4.1-flash',created_at:todayLocal-86400+3600,quota:25000,count:2,token_used:4000}]});
  }
  if (url.pathname === '/api/token') return send(404,{error:{message:'Invalid URL'}});
  // 分组计费倍率在**顶层** group_ratio，不在 data 里；同层还有 usable_group 备注。
  // 数值取真实站点当前价：破甲 0.2、deepseek（纯血号池）0.14、国模特惠 0.02。
  if (url.pathname === '/api/pricing') {
    if (breakPricing) return send(500,{success:false,message:'internal error'});
    return send(200,{success:true,pricing_version:'test',
    data:[{model_name:'gpt-5',model_ratio:1,enable_groups:['破甲分组']}],
    group_ratio:{'国模特惠':0.02,'deepseek（纯血号池）':0.14,'破甲分组':0.2,'grok':0.3},
    usable_group:{'default':'User group','破甲分组':'缓存优化测试','国模特惠':''}});
  }
  if (url.pathname === '/api/token/') return send(200,{success:true,data:{page:1,page_size:100,total:2,items:[
    {id:1430,name:'国模？',key:'abcd****wxyz',used_quota:166216,remain_quota:-166216,unlimited_quota:true,status:1,expired_time:-1,group:'国模特惠'},
    {id:1647,name:'grok',key:'zzzz****9999',used_quota:76891,remain_quota:-76891,unlimited_quota:true,status:2,expired_time:-1,group:'grok'}]}});
  if (url.pathname === '/api/user/topup/self') {
    if (breakTopups) return send(500,{success:false,message:'服务器内部错误'});
    return send(200,{success:true,data:{page:1,page_size:20,total:1,items:[{id:7,amount:5000000,money:10,trade_no:'T7',create_time:now-259200,status:'success'}]}});
  }
  return send(404,{success:false,message:'no such route'});
});

const results = [];
const check = (name, fn) => { try { fn(); results.push({name, ok:true}); } catch(e) { results.push({name, ok:false, message:String(e?.message ?? e)}); } };

await new Promise(r => upstream.listen(0,'127.0.0.1',r));
const port = upstream.address().port;
const { Service, Context } = await import(CORDIS);

const routes = [];
let gate = () => undefined;
class WebServer extends Service { constructor(c){super(c,'webServer')} register(r){routes.push(r);return()=>{}} get host(){return'127.0.0.1'} get protocol(){return'http:'} }
class Connection extends Service { constructor(c){super(c,'connection')} requestRejection(){return gate()} }
const root = new Context(); new WebServer(root); new Connection(root);

const plugin = await import('../lib/index.js');
assert.equal(plugin.name, 'dsh-linksub-usage');
assert.deepEqual(plugin.inject, ['webServer']);

const realFetch = globalThis.fetch;
globalThis.fetch = (u, i) => {
  const s = String(u);
  for (const host of SITE_HOSTS) {
    if (s.startsWith(host)) return realFetch('http://127.0.0.1:' + port + s.slice(host.length), i);
  }
  return realFetch(u, i);
};

const ctx = { webServer: root.webServer, get: k => k==='connection'?root.connection:undefined, effect: f=>f(), logger:{info(){},warn(...a){console.log("[warn]",...a)}} };
plugin.apply(ctx);
assert.equal(routes.length, 1); assert.equal(routes[0].path, '/api/dsh-linksub');

const invoke = async (p, { method='GET', body } = {}) => {
  const bytes = body===undefined?null:Buffer.from(JSON.stringify(body));
  let sent=false;
  const req = Object.assign(new Readable({ read(){ if(sent){this.push(null);return;} sent=true; this.push(bytes); this.push(null); } }), { method, url:'/api/dsh-linksub'+p, headers:{} });
  let status=0, json;
  const res = { writeHead(c){status=c;return res}, end(t){ json = t===undefined?undefined:JSON.parse(t); } };
  await routes[0].handler(req,res);
  return { status, json };
};

const credFile = path.join(TMP_HOME,'linksub-usage','credentials.json');
const snapFile = path.join(TMP_HOME,'linksub-usage','last-good.json');

const s0 = await invoke('/status');
check('⑥ 未配置时 /status 报 configured:false', ()=>{ assert.equal(s0.status,200); assert.equal(s0.json.configured,false); });
const d0 = await invoke('/data');
check('⑥ 未配置时 /data 明确报错', ()=>{ assert.equal(d0.json.ok,false); assert.equal(d0.json.error,'no-credentials'); });

const bad = await invoke('/token',{method:'POST',body:{accessToken:'nap_wrong_token_zzzz'}});
check('⑦ 令牌错误返回 401 且给出人话', ()=>{ assert.equal(bad.status,401); assert.match(String(bad.json.message),/系统访问令牌无效/); });
check('⑦ 令牌错误不落盘', ()=>{ assert.equal(fs.existsSync(credFile),false); });
const empty = await invoke('/token',{method:'POST',body:{accessToken:'   '}});
check('⑦ 空令牌返回 400', ()=>{ assert.equal(empty.status,400); assert.equal(empty.json.ok,false); });

gate = () => 403;
const gated = await invoke('/status');
check('⑧ connection 拒绝时拿不到数据', ()=>{ assert.equal(gated.status,403); });
gate = () => undefined;

const ok = await invoke('/token',{method:'POST',body:{accessToken:TOKEN}});
check('① 令牌校验通过并回显脱敏令牌', ()=>{ assert.equal(ok.status,200); assert.equal(ok.json.ok,true); assert.equal(ok.json.tokenHint,TOKEN_HINT); });
check('① 落盘的就是令牌模式（只有 accessToken）', ()=>{ const j=JSON.parse(fs.readFileSync(credFile,'utf8')); assert.deepEqual(Object.keys(j),['accessToken']); assert.equal(j.accessToken,TOKEN); });
// Windows 的 NTFS 不体现 POSIX mode（chmod 0600 读回来是 0666/依赖 ACL），只做存在性与内容断言。
check('① 凭据落盘且权限 0600', ()=>{ assert.ok(fs.existsSync(credFile)); if (process.platform !== 'win32') assert.equal(fs.statSync(credFile).mode & 0o777, 0o600); else assert.ok(fs.statSync(credFile).isFile()); });

/** 从这里开始记：前面 ⑦ 那次「错误令牌」的探测本身也会打 /api/user/self。 */
const bizFrom = calls.length;
const data = await invoke('/data?force=1');
check('③ /data 成功返回', ()=>{ assert.equal(data.status,200, JSON.stringify(data.json).slice(0,200)); assert.equal(data.json.ok,true); });
const d = data.json.data;
// ⚠️ 面板 quota_display_type=USD 时显示单位是美元面值，**不能**再乘 price=7.3
//    （乘了就是 ¥48.74 那个错误显示）。remainingCny 字段名是历史包袱，装的是「显示面值」。
check('③ 余额 3338326 → 显示 $6.6767（USD 站不乘 7.3）', ()=>{ assert.equal(d.user.remainingQuota,3338326); assert.ok(Math.abs(d.user.remainingUsd-6.676652)<1e-6); assert.ok(Math.abs(d.user.remainingCny-6.676652)<1e-6); });
check('③ 已用与总额（不重叠）', ()=>{ assert.ok(Math.abs(d.user.usedUsd-1161674/500000)<1e-6); assert.equal(d.user.totalQuota,3338326+1161674); });
check('③ 倍率来自站点，USD 站折算率为 1', ()=>{ assert.equal(d.quotaSource,'site'); assert.equal(d.quotaPerUnit,500000); assert.equal(d.priceRatio,1); assert.equal(d.currency,'USD'); });
// 分组计费倍率：站点实时值，按倍率升序，default 补 ×1；与 quota/$ 换算倍率互不干扰。
check('分组倍率来自 /api/pricing 顶层且带系统访问令牌', ()=>{
  assert.equal(d.groupRatios.source,'site');
  assert.ok(calls.slice(bizFrom).some(c=>c.path==='/api/pricing' && c.auth==='Bearer '+TOKEN));
});
check('分组倍率按倍率升序，default 补 ×1', ()=>{
  assert.deepEqual(d.groupRatios.groups.map(g=>g.group),['国模特惠','deepseek（纯血号池）','破甲分组','grok','default']);
  assert.deepEqual(d.groupRatios.groups.map(g=>g.ratio),[0.02,0.14,0.2,0.3,1]);
});
check('分组倍率数值与备注（破甲 0.2 / 纯血号池 0.14）', ()=>{
  const po = d.groupRatios.groups.find(g=>g.group==='破甲分组');
  const ds = d.groupRatios.groups.find(g=>g.group==='deepseek（纯血号池）');
  assert.equal(po.ratio,0.2); assert.equal(po.note,'缓存优化测试');
  assert.equal(ds.ratio,0.14);
  assert.equal(d.groupRatios.groups.find(g=>g.group==='default').source,'default');
});
check('⑨ data/self 带了时间参数', ()=>{ assert.ok(dataQueries.length>0); assert.ok(dataQueries.every(q=>q.includes('start_timestamp=')&&q.includes('end_timestamp=')), JSON.stringify(dataQueries)); });
// 默认范围是 1 天 → 24 个整点格（上游只给 2 个今天的小时，其余补 0）。
check('④ 按小时补齐 24 格', ()=>{ assert.equal(d.usage.bucket,'hour'); assert.equal(d.usage.days.length,24); assert.equal(d.usage.today.quota,200000); assert.equal(d.usage.today.count,5); });
check('④ 今天用本地日期', ()=>{ const dn=new Date(); const l=`${dn.getFullYear()}-${String(dn.getMonth()+1).padStart(2,'0')}-${String(dn.getDate()).padStart(2,'0')}`; assert.equal(d.usage.today.day,l); });
check('按模型降序', ()=>{ assert.equal(d.usage.models[0].model,'gpt-5'); assert.equal(d.usage.models[0].quota,150000); });
check('⑩ 令牌拿到，无限令牌负 remain 归零', ()=>{ assert.equal(d.tokens.length,2); const t=d.tokens.find(x=>x.name==='国模？'); assert.equal(t.unlimited,true); assert.equal(t.remainQuota,0); assert.equal(t.usedQuota,166216); assert.equal(t.status,1); });
check('已删除「最近调用」：返回体不再带 logs', ()=>{ assert.equal(d.logs,undefined); assert.equal(d.logsTotal,undefined); });
check('充值记录字段', ()=>{ assert.equal(d.topups.length,1); assert.equal(d.topups[0].amountQuota,5000000); assert.equal(d.topups[0].money,10); });
check('⑤ 正常时 partial 为空', ()=>{ assert.deepEqual(d.partial,[]); });
check('① 业务请求都带那串令牌', ()=>{ const b=calls.slice(bizFrom).filter(c=>['/api/user/self','/api/data/self','/api/token/','/api/user/topup/self'].includes(c.path)); assert.ok(b.length>=4); assert.ok(b.every(c=>c.auth==='Bearer '+TOKEN), JSON.stringify(b.map(c=>c.path+':'+c.auth))); });
check('① 全程零登录请求', ()=>{ assert.equal(calls.filter(c=>c.path==='/api/user/login').length,0); });
check('已删除「最近调用」：不再请求 /api/log/self', ()=>{ assert.equal(calls.filter(c=>c.path==='/api/log/self').length,0); });

// ⚠️ 切档（1 天 / 7 天 / 30 天）**不许**再打上游、更不许再登录：
//    站点的登录会话有额度上限（AUTH_SESSION_LIMIT），多点几下会把自己锁住。
//    实现方式是「永远按 30 天拉一次，切档纯本地重算」，这条断言就是在守这个约定。
const switchDataBefore = calls.filter(c=>c.path==='/api/data/self').length;
const r7 = await invoke('/data?days=7');
const r30 = await invoke('/data?days=30');
const r1 = await invoke('/data?days=1');
const switchFetches = calls.filter(c=>c.path==='/api/data/self').length - switchDataBefore;
check('⑥ 切 1/7/30 天：0 次重新拉取', ()=>{
  assert.equal(switchFetches,0,`切档触发了 ${switchFetches} 次 /api/data/self`);
});
check('⑥ 切档后粒度各自正确且都命中缓存', ()=>{
  assert.equal(r1.json.data.usage.bucket,'hour');
  assert.equal(r1.json.data.usage.days.length,24);
  assert.equal(r7.json.data.usage.bucket,'half');
  assert.equal(r7.json.data.usage.days.length,14);
  assert.equal(r30.json.data.usage.bucket,'day');
  assert.ok(r30.json.data.usage.days.length>=1 && r30.json.data.usage.days.length<=30, `30 天档 ${r30.json.data.usage.days.length} 格`);
  assert.ok(r7.json.data.cached && r30.json.data.cached && r1.json.data.cached, '切档应命中缓存');
});
check('⑥ 30 天档能看到只有 1 天前的用量，1 天档看不到', ()=>{
  // mock 里有昨天 25000 的一条：7/30 天档该有，1 天档不该有。
  const hasYesterday = (r)=> r.json.data.usage.days.some(x=>x.quota===25000);
  assert.equal(hasYesterday(r30),true,'30 天档应包含昨天用量');
  assert.equal(hasYesterday(r7),true,'7 天档应包含昨天用量');
  assert.equal(hasYesterday(r1),false,'1 天档不应包含昨天用量');
});

const selfBefore = calls.filter(c=>c.path==='/api/user/self').length;
rejectAuth = true;
const afterExpire = await invoke('/data?force=1');
const selfAfter = calls.filter(c=>c.path==='/api/user/self').length;
check('② 令牌失效：报清楚、不重试、不回落登录', ()=>{
  assert.notEqual(afterExpire.status,200, JSON.stringify(afterExpire.json).slice(0,300));
  assert.match(String(afterExpire.json?.message ?? ''),/系统访问令牌已失效/);
  assert.equal(selfAfter-selfBefore,1,`/api/user/self 打了 ${selfAfter-selfBefore} 次（应该正好 1 次，不重试）`);
});
rejectAuth = false;

// 原来这里断言「日志接口 500 时余额仍显示」；调用记录已删除，改写成品类接口失败。
breakTopups = true;
const partial = await invoke('/data?force=1');
check('⑤ 充值接口 500 时余额仍显示，partial 记一笔', ()=>{ assert.equal(partial.status,200); assert.ok(partial.json.data.user.remainingUsd>0); assert.ok(partial.json.data.partial.some(x=>x.part==='充值记录')); });
breakTopups = false;

// 分组倍率接口挂了 → 回落「上次成功快照」，不许让余额/用量一起挂，也不许写死常量。
breakPricing = true;
const grFallback = await invoke('/data?force=1');
check('分组倍率接口 500 时回落快照且余额仍在', ()=>{
  assert.equal(grFallback.status,200);
  assert.ok(grFallback.json.data.user.remainingUsd>0);
  assert.equal(grFallback.json.data.groupRatios.source,'snapshot');
  assert.equal(grFallback.json.data.groupRatios.groups.find(g=>g.group==='破甲分组').ratio,0.2);
  assert.ok(grFallback.json.data.groupRatios.groups.every(g=>g.source==='snapshot'));
});
breakPricing = false;

check('快照已落盘', ()=>{ assert.ok(fs.existsSync(snapFile)); assert.ok(JSON.parse(fs.readFileSync(snapFile,'utf8')).user.remainingUsd>0); });
const s1 = await invoke('/status');
check('/status 带回快照', ()=>{ assert.equal(s1.json.configured,true); assert.ok(s1.json.snapshot.user.remainingUsd>0); });

const beforeCached = calls.length;
await invoke('/data?force=0');
check('60 秒内命中缓存不打上游', ()=>{ assert.equal(calls.length,beforeCached); });

const out = await invoke('/disconnect',{method:'POST'});
check('清除令牌', ()=>{ assert.equal(out.json.ok,true); assert.equal(fs.existsSync(credFile),false); assert.equal(fs.existsSync(snapFile),false); });
const wm = await invoke('/token');
check('GET /token 返回 405', ()=>{ assert.equal(wm.status,405); });
const nf = await invoke('/nope');
check('未知子路由 404', ()=>{ assert.equal(nf.status,404); });

globalThis.fetch = realFetch;
upstream.close();
await fsp.rm(TMP_HOME,{recursive:true,force:true}).catch(()=>{});

const failed = results.filter(r=>!r.ok);
console.log('');
for (const r of results) console.log(`  ${r.ok?'✓':'✗'} ${r.name}${r.ok?'':`\n      → ${r.message}`}`);
console.log('');
console.log(failed.length===0 ? `ALL_TESTS_OK (${results.length}/${results.length})` : `FAILED ${failed.length}/${results.length}`);
process.exitCode = failed.length===0?0:1;
