# dsh-linksub-usage

**DeepSeek Harness 桌面版插件**：在设置页里查看 [linksub.fun](https://linksub.fun)（New API 面板）的账户用量。

> 非官方插件，与 linksub.fun 无 affiliation。只在本机直连面板接口，不向任何第三方转发数据。

## 它能显示什么

| 区块 | 内容 |
|---|---|
| 余额 | 剩余 quota / 美元（或面板设定的人民币、自定义货币） |
| 关键数字 | 已用额度、历史总额、今日消耗、调用次数 |
| 用量趋势 | 1 天（24 小时）/ 7 天（12 小时格）/ 30 天（按天）曲线，自动补零格子 |
| 按模型 | 每个模型的消耗占比 |
| API 令牌 | 名称、脱敏 key、状态、已用、剩余、**分组**与**分组计费倍率** |
| 分组计费倍率 | 站点全部可用分组的倍率全表（升序）、站点备注、标记本账号在用的分组 |
| 充值记录 | 实付金额、充入额度、时间 |
| 账户信息 | 账号、默认分组及其倍率、余额/已用 quota、状态、额度换算来源 |

### 分组倍率是怎么来的

`GET /api/pricing` 的**响应顶层** `group_ratio` 是 `{ "分组名": 倍率 }` 映射（**不在** `data` 里，`data` 是逐模型价格表）；同层 `usable_group` 是分组备注。插件每次抓全量时读一次实时值，按倍率升序展示，`default` 组站点没给就按 New API 规则补 ×1。

读不到时**回落「上次成功快照」并标明来源**，绝不拿写死的常量冒充 —— 这类中转站改价很频繁，硬编码的倍率第二天就是错的。分组倍率与「500000 quota/$」的额度换算倍率是两件事，界面上分别叫「分组倍率」和「额度换算」。

## 鉴权与安全

- **只用「系统访问令牌」**：linksub.fun 控制台 → 个人设置 → 系统访问令牌。站点在 2026-11-13 给密码登录加了阿里云人机验证，脚本登录必被拦，所以插件不发任何登录请求。
- 令牌只存在本机 `$DSH_HOME/linksub-usage/credentials.json`（0600），界面可一键清除；接口只回显前 4 后 4 的脱敏串。
- 所有本地路由挂在 `/api/dsh-linksub/*`，先过引擎的 `connection.requestRejection(req)`（loopback + 会话 cookie）。拿不到该服务时 **503 fail-closed**，不降级。
- 令牌列表**不回传 key 明文**，只展示上游已经脱敏过的掩码串。

## 安装（Windows · DSH 桌面版）

这个包依赖 DSH 的 `webServer` / `connection` / 设置页 slot / `locale` / `__ModuleLoader__` 等运行时服务，**不是通用 npm 包**，只能作为 DSH bundle 加载。

1. 源码放到 profile 的 bundles 目录：

   ```
   %USERPROFILE%\.dsh\profiles\desktop\bundles\dsh-linksub-usage\
   ```

2. 在 `<profile>\package.json` 的 `dependencies` 里用 `link:` 声明（**不要**手工塞进 `node_modules`，否则装/卸插件跑一次 pnpm 就会被移走）：

   ```json
   "dsh-linksub-usage": "link:./bundles/dsh-linksub-usage"
   ```

3. 在 `<profile>\cordis.patch.yml` 追加注册：

   ```yaml
   - insert:
       - id: linksub-usage
         name: 'dsh-linksub-usage'
   ```

4. 用 DSH 运行时自带的 node / pnpm 跑一次安装（它们不在 PATH 里）：

   ```powershell
   & "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" `
     "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" install
   ```

5. **完整重启 DSH**，打开「设置 → LinkSub 用量」，粘贴系统访问令牌 → 保存并验证。

## 测试

离线测试用本地模拟服务器复刻真实响应形态，不需要账号也不需要联网：

```powershell
$env:ENGINE_NODE_MODULES = "<DSH 安装目录>\resources\app\dsh\node_modules"  # 指向含 @deepseek-ai/cordis 的 node_modules
$env:DSH_HOME = "<任意临时目录>"
node test/bundle-check.mjs
node test/e2e.mjs
node test/token-mode.mjs
node test/render-full.mjs          # 另可用 $env:TEST_DAYS=7 测 7 天档
```

`test/live-check.mjs` 是可选的真实站点冒烟测试：

```powershell
$env:LS_TOKEN = "<系统访问令牌>"
node test/live-check.mjs
```

覆盖到的行为：令牌模式零登录请求、超时自动重试一次、令牌失效不回落登录、切档只本地重算不重拉、`/api/data/self` 必须带时间参数、`/api/token/` 尾斜杠、无限额度令牌负 remain 归零、分组倍率读取/排序/`default` 补全/接口 500 时回落快照、渲染层不出现 `undefined` / `NaN`。

## 目录结构

```
dsh-linksub-usage/
├── cordis.patch.yml        # bundle 注册声明
├── package.json            # dsh.bundle / dsh.client 清单
├── lib/
│   ├── index.js            # 宿主半：凭据、上游会话、路由、抓取与整形
│   └── client.js           # 客户端半：设置页 React 分节（双语）
└── test/                   # 离线端到端 / 令牌模式 / 渲染 / 真实冒烟
```

## 许可

MIT，见 [LICENSE](LICENSE)。
