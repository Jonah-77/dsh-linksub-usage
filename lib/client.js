window.__ModuleLoader__.load({
	id: "dsh-linksub-usage",
	factory: (require) => {
		"use strict";
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		/**
		 * dsh-linksub-usage —— 客户端半（浏览器侧）。
		 *
		 * 在设置页注册一个「linksub 用量」分节：余额、已用、请求数、今日消耗、
		 * 近 1 / 3 / 7 / 30 天（或自定义天数）的曲线、按模型统计、API 令牌、调用记录、
		 * 充值记录、账户信息。
		 *
		 * ## 数据从哪来
		 *
		 * 一律走宿主半的 `/api/dsh-linksub/*`（同源 fetch，天然带会话 cookie）。
		 * **浏览器不直连 linksub.fun**：CSP 与同源策略都不允许跨域，而且系统访问令牌
		 * 必须留在 Node 侧 —— 放进浏览器等于把令牌交给前端代码。
		 *
		 * ## ⚠️ 不渲染任何未经转义的上游文本
		 *
		 * 模型名、令牌名、调用记录里的 `content` 都是**上游可控字符串**，经 React
		 * 渲染天然转义；本文件绝不拼 HTML 字符串（不用 `dangerouslySetInnerHTML`）。
		 *
		 * ## ⚠️ 取服务必须用 `scope` 上的，不能用外层 `ctx`
		 *
		 * Cordis 的 `ctx.xxx` 要求当前 fiber 声明过该依赖。本插件 `exports.inject`
		 * 是空数组，外层 `ctx` 上取不到；`ctx.inject([...])` 的子 fiber 才是能取的那个。
		 * （同 `dsh-android-market` 与移动端 UI 插件的注释。）
		 */

		/** 宿主半的路由前缀。与 `lib/index.js` 的 `ROUTE_PREFIX` 必须一致。 */
		const BASE = "/api/dsh-linksub";

		/** locale 命名空间。 */
		const NS = "dsh-linksub-usage";

		/** 分节在设置页的排序位：官方 plugins=15、本 App 的「特权权限」=25、市场=26。 */
		const ORDER = 27;

		const ZH = {
			nav: "linksub 用量",
			intro: "你的 linksub.fun 账户：余额、消耗、调用记录。数据由本机直连面板接口取得。",
			loginTitle: "连接账户",
			loginHint:
				"填一次「系统访问令牌」就行：linksub.fun 控制台 → 个人设置 → 系统访问令牌 → 生成，整串复制粘到这里。令牌只存在本机，随时可在此清除。站点从 2026-11-13 起给密码登录加了人机验证，所以这里不再收账号密码。",
			username: "账号",
			accessToken: "系统访问令牌",
			save: "保存并验证",
			saving: "验证中…",
			saved: "已连接",
			clear: "清除令牌",
			clearing: "清除中…",
			cleared: "已清除",
			refresh: "刷新",
			refreshing: "刷新中…",
			remaining: "剩余余额",
			used: "已用额度",
			total: "历史总额",
			today: "今日消耗",
			requests: "调用次数",
			group: "分组",
			groupRatio: "分组倍率",
			groupRatioCard: "分组计费倍率",
			groupRatioHint: "站点实时价（/api/pricing），按倍率升序 · 低者更便宜",
			groupRatioSnapshot: "实时价读取失败，显示上次成功快照",
			groupRatioUnavailable: "倍率接口未读到（/api/pricing），此次不显示",
			groupRatioDefault: "默认组 ×1",
			groupRatioUsed: "在用",
			groupRatioNote: "站点说明",
			invite: "邀请奖励",
			trend: "用量趋势",
			byModel: "按模型",
			tokens: "API 令牌",
			topups: "充值记录",
			account: "账户信息",
			noData: "暂无数据",
			partial: "部分数据读取失败",
			cachedFrom: "缓存于",
			days: "天",
			model: "模型",
			quota: "额度",
			count: "次数",
			time: "时间",
			status: "状态",
			amount: "金额",
			noTokens: "没有 API 令牌",
			noTopups: "没有充值记录",
			unlimited: "无限额度",
			notConfigured: "尚未连接账户",
			errorLogin: "连接失败",
			errorData: "读取失败",
			needLoginFirst: "请先在上面填写系统访问令牌",
			spentToday: "今日",
			name: "名称",
			token: "令牌",
			tokens: "tokens",
			spent: "消耗",
			remain: "剩余",
		};

		const EN = {
			nav: "linksub usage",
			intro: "Your linksub.fun account: balance, spend and request log, read directly from the panel API on this device.",
			loginTitle: "Connect account",
			loginHint:
				"Paste your linksub.fun system access token once (console → Personal settings → System access token). It is stored on this device only; you can clear it here at any time. Password login is no longer supported: the site added a human verification to it on 2026-11-13.",
			username: "Username",
			accessToken: "System access token",
			save: "Save & verify",
			saving: "Verifying…",
			saved: "Connected",
			clear: "Clear token",
			clearing: "Clearing…",
			cleared: "Cleared",
			refresh: "Refresh",
			refreshing: "Refreshing…",
			remaining: "Remaining",
			used: "Used",
			total: "All-time",
			today: "Today",
			requests: "Requests",
			group: "Group",
			groupRatio: "Ratio",
			groupRatioCard: "Group billing ratios",
			groupRatioHint: "Live from /api/pricing · ascending (cheaper first)",
			groupRatioSnapshot: "Live read failed; showing last good snapshot",
			groupRatioUnavailable: "Ratio endpoint unavailable (/api/pricing)",
			groupRatioDefault: "default ×1",
			groupRatioUsed: "used",
			groupRatioNote: "Site note",
			invite: "Referral credit",
			trend: "Usage trend",
			byModel: "By model",
			tokens: "API keys",
			topups: "Top-ups",
			account: "Account",
			noData: "No data",
			partial: "Some sections failed",
			cachedFrom: "cached",
			days: "days",
			model: "Model",
			quota: "Quota",
			count: "Calls",
			time: "Time",
			status: "Status",
			amount: "Amount",
			noTokens: "No API keys",
			noTopups: "No top-ups",
			unlimited: "Unlimited",
			notConfigured: "Not connected",
			errorLogin: "Connect failed",
			errorData: "Read failed",
			needLoginFirst: "Paste your system access token above first",
			spentToday: "today",
			name: "Name",
			token: "Key",
			tokens: "tokens",
			spent: "Spent",
			remain: "Left",
		};

		// ─────────────────────────── 样式 ───────────────────────────

		/**
		 * 全部样式内联成对象。**只用主题 token**（`--dsw-*`），这样深色模式和
		 * 别人换的主题都能自动跟着变；写死颜色会在深色下变成一片看不清。
		 */
		const css = {
			section: { display: "flex", flexDirection: "column", gap: 14, padding: "2px 0 20px" },
			intro: { margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-tertiary)" },
			card: {
				border: "0.5px solid var(--dsw-alias-border-l2)",
				borderRadius: "var(--dsw-radius-md)",
				background: "var(--dsw-alias-bg-layer-1)",
				padding: "12px 14px",
			},
			cardTitle: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 8,
				margin: "0 0 10px",
				fontSize: 12,
				fontWeight: 600,
				color: "var(--dsw-alias-label-secondary)",
			},
			hero: {
				display: "flex",
				flexDirection: "column",
				gap: 10,
				borderRadius: "var(--dsw-radius-md)",
				border: "0.5px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-fill-l1)",
				padding: "14px 16px",
			},
			heroLabel: { fontSize: 11, letterSpacing: ".04em", color: "var(--dsw-alias-label-tertiary)" },
			heroValue: {
				fontSize: 32,
				lineHeight: "38px",
				fontWeight: 600,
				fontVariantNumeric: "tabular-nums",
				color: "var(--dsw-alias-label-primary)",
			},
			heroRaw: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)", fontVariantNumeric: "tabular-nums" },
			grid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 },
			stat: {
				display: "flex",
				flexDirection: "column",
				gap: 2,
				borderRadius: "var(--dsw-radius-sm)",
				background: "var(--dsw-alias-fill-l1)",
				padding: "9px 11px",
			},
			statLabel: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)" },
			statValue: {
				fontSize: 17,
				fontWeight: 600,
				fontVariantNumeric: "tabular-nums",
				color: "var(--dsw-alias-label-primary)",
			},
			statSub: { fontSize: 10, color: "var(--dsw-alias-label-tertiary)", fontVariantNumeric: "tabular-nums" },
			row: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "4px 0", fontSize: 12 },
			rowLabel: { color: "var(--dsw-alias-label-tertiary)" },
			rowValue: {
				color: "var(--dsw-alias-label-primary)",
				textAlign: "right",
				wordBreak: "break-all",
				fontVariantNumeric: "tabular-nums",
			},
			mono: { fontFamily: "var(--dsw-font-mono)", fontSize: 11 },
			input: {
				boxSizing: "border-box",
				width: "100%",
				height: 34,
				padding: "0 10px",
				fontSize: 13,
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-layer-2)",
				border: "0.5px solid var(--dsw-alias-border-l2)",
				borderRadius: "var(--dsw-radius-sm)",
				outline: "none",
			},
			field: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 },
			fieldLabel: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)" },
			actions: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
			button: {
				height: 32,
				padding: "0 14px",
				fontSize: 12,
				fontWeight: 500,
				borderRadius: "var(--dsw-radius-sm)",
				border: "0.5px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-button-elevated-fill)",
				color: "var(--dsw-alias-label-primary)",
				cursor: "pointer",
			},
			primary: {
				color: "var(--dsw-alias-label-primary-inverted)",
				background: "var(--dsw-alias-button-primary-fill)",
				border: "0.5px solid var(--dsw-alias-button-primary-fill)",
			},
			danger: {
				color: "var(--dsw-alias-state-error-primary)",
				border: "0.5px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent)",
			},
			message: { fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-secondary)" },
			error: { fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-state-error-primary)" },
			warn: { fontSize: 11, lineHeight: "17px", color: "var(--dsw-alias-state-warn-primary)" },
			empty: { margin: 0, fontSize: 12, color: "var(--dsw-alias-label-tertiary)" },
			list: { display: "flex", flexDirection: "column", gap: 1 },
			barRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "3px 0" },
			barLabel: {
				flex: "0 0 34%",
				minWidth: 0,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				color: "var(--dsw-alias-label-secondary)",
			},
			barTrack: { flex: 1, height: 6, borderRadius: 3, background: "var(--dsw-alias-fill-l2)", overflow: "hidden" },
			barFill: { height: "100%", borderRadius: 3, background: "var(--dsw-alias-brand-primary)" },
			barValue: {
				flex: "0 0 auto",
				minWidth: 62,
				textAlign: "right",
				fontVariantNumeric: "tabular-nums",
				color: "var(--dsw-alias-label-primary)",
			},
			// ⚠️ 必须 alignItems:"stretch"（默认值）。
			//    以前写 flex-end，而每列是「柱 + 横轴标签」的 flex column：有标签的列整体
			//    被顶高，柱子跟着往上窜，于是「有字的地方柱子高」—— 那是布局假象，不是数据。
			//    现在每条 chartCol 撑满整高（justifyContent:flex-end 让柱子贴底），
			//    标签用固定高度的 chartAxis 区，所有柱子从同一条基线起量。
			chart: { display: "flex", alignItems: "stretch", gap: 2, height: 76, overflowX: "auto" },
			segmented: { display: "inline-flex", gap: 2, padding: 2, borderRadius: 8, background: "var(--dsw-alias-fill-l2)" },
			segment: {
				padding: "4px 8px",
				fontSize: 11,
				border: "none",
				borderRadius: 6,
				background: "transparent",
				color: "var(--dsw-alias-label-secondary)",
				cursor: "pointer",
			},
			// ⚠️ 选中态字色必须跟着主题反转，不能写死 #fff：
			//    --dsw-alias-brand-primary 浅色主题是近黑(#0f1115)、深色主题是近白(#f9fafb)，
			//    写死白字在深色模式下就是「白底白字」，1 天 / 7 天 / 30 天 整块看不见。
			//    label-primary-inverted 与上面 primary 按钮用的是同一对前景色（浅色 #fff、深色 #353638）。
			segmentOn: { background: "var(--dsw-alias-brand-primary)", color: "var(--dsw-alias-label-primary-inverted)" },
			chartWrap: { display: "flex", alignItems: "flex-start", gap: 6 },
			chartYAxis: { display: "flex", flexDirection: "column", justifyContent: "space-between", height: 76, flex: "0 0 auto" },
			chartYTick: {
				fontSize: 9,
				lineHeight: "12px",
				color: "var(--dsw-alias-label-tertiary)",
				fontVariantNumeric: "tabular-nums",
				textAlign: "right",
				minWidth: 30,
			},
			chartMain: { flex: 1, minWidth: 0 },
			chartXLabel: {
				// 固定高度：有没有文字都占这一格，保证同一行所有柱子基线一致。
				// 交给对象自身的 height 会随内容变化，所以这里写死 lineHeight 且不设 height，
				// 由 .chartAxis 统一占位。
				fontSize: 8,
				lineHeight: "12px",
				color: "var(--dsw-alias-label-tertiary)",
				whiteSpace: "nowrap",
				fontVariantNumeric: "tabular-nums",
			},
			chartCol: {
				display: "flex",
				flexDirection: "column",
				justifyContent: "flex-end",
				alignItems: "center",
				gap: 3,
				flex: "0 0 auto",
				minWidth: 5,
				height: "100%",
			},
			chartBar: { width: 7, borderRadius: 2, background: "var(--dsw-alias-brand-primary)", minHeight: 2 },
			chartBarZero: { width: 7, borderRadius: 2, background: "var(--dsw-alias-fill-l2)", height: 2 },
			table: { width: "100%", borderCollapse: "collapse", fontSize: 11 },
			th: {
				textAlign: "left",
				fontWeight: 500,
				color: "var(--dsw-alias-label-tertiary)",
				padding: "4px 6px 4px 0",
				borderBottom: "0.5px solid var(--dsw-alias-border-l1)",
			},
			td: {
				padding: "5px 6px 5px 0",
				borderBottom: "0.5px solid var(--dsw-alias-border-l1)",
				color: "var(--dsw-alias-label-primary)",
				verticalAlign: "top",
			},
			tdNum: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
			scroll: { maxHeight: 260, overflowY: "auto" },
			pill: {
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				fontSize: 10,
				lineHeight: "16px",
				padding: "0 6px",
				borderRadius: 8,
				background: "var(--dsw-alias-fill-l2)",
				color: "var(--dsw-alias-label-secondary)",
			},
			ok: { color: "var(--dsw-alias-state-success-primary)", fontSize: 11 },
			off: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11 },
			skeleton: {
				height: 12,
				borderRadius: 6,
				background: "var(--dsw-alias-fill-l2)",
				margin: "6px 0",
			},
		};

		// ─────────────────────────── 小工具 ───────────────────────────

		/**
		 * 回看范围的快选项。
		 *
		 * ⚠️ 面板（new-api）的日志接口是**按天**查询的，`/api/data/self` 也天粒度，
		 * 所以「几小时内」这种范围上游给不了 —— 能精确到 1 天，再细就是 0 根柱子。
		 * 想看小时级看哪：选 1 天，趋势图会自动切成**按小时**的 24 根柱子
		 * （宿主半 `shapeQuotaData` 的 bucket='hour'）。
		 */
		const RANGE_PRESETS = [
			{ days: 1, label: "1 天" },
			{ days: 7, label: "7 天" },
			{ days: 30, label: "30 天" },
		];

		/** 默认回看天数：1 天（和「今天用了多少」这个日常问题对齐）。 */
		const DEFAULT_DAYS = 1;

		/** `1` → `近 1 天`；`1.5` 只可能在小时粒度下被算出，所以整点天数更直观。 */
		function rangeLabel(days) {
			const n = Number(days) || DEFAULT_DAYS;
			return `近 ${n} 天`;
		}

		/**
		 * 面板显示单位的符号。
		 *
		 * ⚠️ 站点 `quota_display_type=USD` 时，面板显示的是**人民币符号 + 美元面值**
		 * （官网余额写 ¥6.62），所以这里按「显示哪种货币」挑符号，而不是按「这个数是
		 * 美元还是人民币」挑 —— `usd` 这个函数名是历史包袱，数值其实一直是**显示面值**。
		 * 旧版一律写 `$`，于是同一个 ¥6.62 在不同卡片上时而 ¥ 时而 $。
		 */
		function unitSymbol(currency) {
			const unit = String(currency ?? "").toUpperCase();
			if (unit === "USD") return "$";
			return "¥"; // CNY / CUSTOM
		}

		/** 两位小数；余额常小到 0.003，所以小额时给 4 位。符号跟着显示单位走。 */
		function usd(value, currency) {
			const sign = unitSymbol(currency);
			const n = Number(value) || 0;
			if (n === 0) return `${sign}0.00`;
			if (Math.abs(n) < 0.01) return `${sign}${n.toFixed(4)}`;
			return `${sign}${n.toFixed(2)}`;
		}

		/** 人民币两位小数。**只用于实付金额**（充值记录里的 money 本身就是人民币）。 */
		function cny(value) {
			const n = Number(value) || 0;
			if (n === 0) return "¥0.00";
			if (Math.abs(n) < 0.01) return `¥${n.toFixed(4)}`;
			return `¥${n.toFixed(2)}`;
		}

		/**
		 * 按**面板自己的显示单位**格式化金额。
		 *
		 * 站点的 `quota_display_type` 决定面板显示什么：本站是 `USD`，
		 * 官网写「余额 $6.62」，这里就必须也写 $6.62（旧版一律折成 ¥，多乘了 7.3，
		 * 显示成 ¥48.31，看起来像是钱不见了）。`data.priceRatio` 由宿主半按
		 * new-api 的规则算好（USD → 1，CNY → usd_exchange_rate），这里只挑符号。
		 */
		function money(value, currency) {
			return usd(value, currency);
		}

		/** 千分位整数。 */
		function int(value) {
			return (Number(value) || 0).toLocaleString("zh-CN");
		}

		/**
		 * 分组计费倍率 → `×0.2` 这样的短串；没匹配到就 `—`。
		 *
		 * ⚠️ 这个倍率和「quota/$ 换算倍率」（500000）完全无关，别复用那个字段名。
		 * 分组名按站点返回的原样精确匹配（中文、括号、全角都要一致）。
		 */
		function ratioText(rows, group) {
			const hit = rows.find((r) => r.group === group);
			return hit === undefined || !Number.isFinite(Number(hit.ratio)) ? "—" : `×${Number(hit.ratio)}`;
		}

		/** epoch 秒 → `MM-DD HH:mm`。**用本地时区**，不用 UTC。 */
		function stamp(epochSeconds) {
			const n = Number(epochSeconds) || 0;
			if (n <= 0) return "—";
			const d = new Date(n * 1000);
			const pad = (v) => String(v).padStart(2, "0");
			return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
		}

		/** 相对时间：`3 分钟前`。让「数据多旧」一眼看出来。 */
		function ago(ms) {
			const delta = Date.now() - Number(ms || 0);
			if (!Number.isFinite(delta) || delta < 0) return "";
			const min = Math.floor(delta / 60000);
			if (min < 1) return "刚刚";
			if (min < 60) return `${min} 分钟前`;
			const hour = Math.floor(min / 60);
			if (hour < 24) return `${hour} 小时前`;
			return `${Math.floor(hour / 24)} 天前`;
		}

		/**
		 * 单次请求的**硬超时**。
		 *
		 * ⚠️ 没有它的时候，只要这一跳（页面 → 引擎）不回话，`busy` 就一直不落地，
		 *    界面所有按钮都停在 `disabled` 上 —— 表现就是「点什么都没反应、卡住」，
		 *    而且永远等不到错误提示。有超时至少能报错、能把按钮放回来。
		 *    30s 是留给「引擎刚起、上游在重试」的余量：正常一次只要几百毫秒。
		 */
		const REQUEST_TIMEOUT_MS = 30000;

		/**
		 * 把一行诊断写进宿主半的 `diag.log`。
		 *
		 * ⚠️ 用**裸 fetch**，不走 {@link call}：否则 call 里的上报又触发上报，自己咬自己。
		 * ⚠️ 一律吞掉异常：诊断坏了不许影响界面。
		 */
		function diag(tag, text) {
			try {
				window
					.fetch(BASE + "/diag", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ tag, text }),
						cache: "no-store",
					})
					.catch(() => {});
			} catch {
				// 忽略：诊断通道不可用（旧版宿主还没有 /diag）时保持静音。
			}
		}

		/** 统一的 GET/POST。失败时抛出**上游给的人话**，而不是 `HTTP 500`。 */
		async function call(method, path, body) {
			const init = { method, cache: "no-store", headers: {} };
			if (body !== undefined) {
				init.headers["content-type"] = "application/json";
				init.body = JSON.stringify(body);
			}
			const startedAt = Date.now();
			const canAbort = typeof AbortController === "function";
			const controller = canAbort ? new AbortController() : null;
			if (controller) init.signal = controller.signal;
			const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
			try {
				const res = await window.fetch(BASE + path, init);
				let json;
				try {
					json = await res.json();
				} catch {
					throw new Error(`HTTP ${res.status}`);
				}
				if (json?.ok !== true) {
					throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
				}
				diag("web", `${method} ${path} ok ${Date.now() - startedAt}ms`);
				return json;
			} catch (e) {
				const ms = Date.now() - startedAt;
				if (e && e.name === "AbortError") {
					diag("web", `${method} ${path} 超时 ${ms}ms（>${REQUEST_TIMEOUT_MS}ms）`);
					throw new Error(`请求超时：${Math.round(ms / 1000)} 秒没有回应（引擎或上游卡住了）`);
				}
				diag("web", `${method} ${path} 失败 ${ms}ms：${String((e && e.message) || e)}`);
				throw e;
			} finally {
				if (timer) clearTimeout(timer);
			}
		}

		// ─────────────────────────── 组件片段 ───────────────────────────

		/** 一个统计格子：标签 / 大数字 / 副行。 */
		function Stat(React, key, label, value, sub) {
			return React.createElement(
				"div",
				{ key, style: css.stat },
				React.createElement("span", { style: css.statLabel }, label),
				React.createElement("span", { style: css.statValue }, value),
				sub === undefined ? null : React.createElement("span", { style: css.statSub }, sub),
			);
		}

		/** 一行「标签 —— 值」。 */
		function Field(React, key, label, value, mono) {
			return React.createElement(
				"div",
				{ key, style: css.row },
				React.createElement("span", { style: css.rowLabel }, label),
				React.createElement("span", { style: mono ? { ...css.rowValue, ...css.mono } : css.rowValue }, value),
			);
		}

		/**
		 * 卡片外壳。`extra` 是标题右侧那枚小胶囊的文字（传 `undefined` 就不显示）；
		 * 卡片内容一律走 `...children`，`null` 会被滤掉，方便条件渲染。
		 */
		function Card(React, key, title, extra, ...children) {
			const children2 = children.filter(Boolean);
			return React.createElement(
				"div",
				{ key, style: css.card },
				React.createElement(
					"div",
					{ style: css.cardTitle },
					React.createElement("span", null, title),
					typeof extra === "string" && extra !== "" ? React.createElement("span", { style: css.pill }, extra) : null,
				),
				...children2,
			);
		}

		/** 横向占比条列表：模型用量、令牌用量都用它。 */
		function BarList(React, key, items, emptyText) {
			if (items.length === 0) {
				return React.createElement("p", { key, style: css.empty }, emptyText);
			}
			const max = Math.max(...items.map((i) => i.value), 1);
			return React.createElement(
				"div",
				{ key, style: css.list },
				...items.map((item, index) =>
					React.createElement(
						"div",
						{ key: `${item.label}-${index}`, style: css.barRow },
						React.createElement("span", { style: css.barLabel, title: item.label }, item.label),
						React.createElement(
							"span",
							{ style: css.barTrack },
							React.createElement("span", {
								style: { ...css.barFill, width: `${Math.max(1, (item.value / max) * 100)}%` },
							}),
						),
						React.createElement("span", { style: css.barValue }, item.text),
					),
				),
			);
		}

		/**
		 * 用量柱状图 —— **带横轴时间标签和纵轴刻度**。
		 *
		 * 之前只有柱子没有任何坐标，看的人无法判断一根柱子对应哪段时间、多高算多少钱，
		 * 等于白画。现在三件东西一起给：
		 *   ① 纵轴：左侧显示 0 / 中值 / 最大值三档刻度（用显示单位，跟别处一致）；
		 *   ② 横轴：柱子下面按宽度自动抽稀时间标签（`MM-DD` 或 `HH:00`）；
		 *   ③ 每根柱子仍然带 `title`，长按/悬停能看精确值。
		 *
		 * @param days - `usage.days`，每项 `{day, usd, count}`。
		 * @param currency - 显示单位（`USD` / `CNY` / `CUSTOM`），决定金额符号。
		 * @param bucket - `hour` 标 `HH:00`；`half`（12 小时格）标 `MM-DD HH:00`；`day` 标 `MM-DD`。
		 */
		function Chart(React, key, days, currency, bucket) {
			if (days.length === 0) return React.createElement("p", { key, style: css.empty }, "—");
			const max = Math.max(...days.map((d) => d.usd), 0.000001);
			const barWidth = days.length > 60 ? 4 : days.length > 31 ? 6 : 7;
			// 标签抽稀：1 天（24 格）标整点、7 天（14 格）标到 `MM-DD HH:00`、
			// 30 天以上只标 `MM-DD`。格子少的时候全标，多了才隔几个标一个。
			const every = days.length <= 8 ? 1 : days.length <= 16 ? 2 : Math.ceil(days.length / 8);
			// 桶键只有两种形状：`YYYY-MM-DD` 或 `MM-DD HH:00`，都取「月-日」+ 可选「时:分」。
			const tick = (d) => {
				const text = String(d.day); // `YYYY-MM-DD` 或 `MM-DD HH:00`
				const cut = text.indexOf(" ");
				const date = cut >= 0 ? text.slice(0, cut) : text;
				const time = cut >= 0 ? text.slice(cut + 1) : "";
				if (bucket === "hour") return time; // 24 根：只标 00:00
				if (bucket === "half") return `${date.slice(-5)} ${time}`; // 14 根：10-20 00:00
				return date.slice(-5); // 按天：10-22
			};

			return React.createElement(
				"div",
				{ key, style: css.chartWrap },
				// ── 纵轴刻度 ──
				React.createElement(
					"div",
					{ style: css.chartYAxis },
					...[max, max / 2, 0].map((v, i) =>
						React.createElement("span", { key: `y${i}`, style: css.chartYTick }, compactMoney(v, currency)),
					),
				),
				// ── 柱形区 + 横轴 ──
				React.createElement(
					"div",
					{ style: css.chartMain },
					React.createElement(
						"div",
						{
							style: css.chart,
							// 初始停在**最右侧**：天/格数一多，柱子就横向溢出，
							// 而真正要看的永远是「最近这几格」——默认停最左，等于每次进来
							// 都得往右划一下。见 pinChartToEnd()。
							ref: pinChartToEnd(days),
						},
						...days.map((d, i) =>
							React.createElement(
								"div",
								{
									key: d.day,
									style: { ...css.chartCol, flex: "0 0 auto" },
									title: `${d.day}  ${money(d.usd, currency)}  ${int(d.count)} 次`,
								},
								React.createElement("div", {
									style:
										d.usd > 0
											? { ...css.chartBar, width: barWidth, height: `${Math.max(3, (d.usd / max) * 66)}px` }
											: { ...css.chartBarZero, width: barWidth },
								}),
								// 横轴标签：每 every 根标一个，其余留一个同高度的空格子占位。
								// ⚠️ 空格子必须照样渲染（不能用 null 跳过），否则那一列少了一行、
								//    柱子会比邻居矮一截 —— 就是上一版「有字的地方柱子高」的成因。
								React.createElement(
									"span",
									{ style: css.chartXLabel },
									i % every === 0 ? tick(d) : "\u00a0",
								),
							),
						),
					),
				),
			);
		}

		/**
		 * 返回一个 ref 回调，把柱形图的滚动容器**滚到最右端**（初始位置 = 最新数据）。
		 *
		 * ⚠️ 这里**不用** `useEffect`：`Chart()` 是普通函数而不是组件（被直接当作
		 *    表达式调用，`Chart(React, ...)`），在它内部调 hook 会插进**调用方**的
		 *    hook 序列里；而图表是在 `data !== undefined` 时才被调用的，等于条件
		 *    调用 hook —— 顺序一变 React 直接抛错。所以走 ref 回调。
		 *
		 * ⚠️ 但 ref 回调每次渲染都是新的箭头函数，React 会「先 null、后 el」重挂一次，
		 *    于是**每次重渲染都会触发**。纯滚动（用户手指往左划）不会引发渲染，所以
		 *    平时没事；可一旦有别的状态变了（快选天数、刷新），就会把用户手动划到的
		 *    位置拽回右边。因此在 DOM 节点上记一个「数据签名」，签名没变就不动位置。
		 *
		 * 首次挂载那一帧布局可能还没算完，`scrollWidth` 偶尔偏小，所以再补一次
		 * `requestAnimationFrame` 兜底（两帧都执行也只会停在同一个位置，幂等）。
		 */
		function pinChartToEnd(days) {
			return (el) => {
				if (!el) return;
				const first = days.length > 0 ? days[0].day : "";
				const last = days.length > 0 ? days[days.length - 1].day : "";
				const sig = `${days.length}|${first}|${last}`;
				if (el.getAttribute("data-pin") === sig) return;
				el.setAttribute("data-pin", sig);
				const pin = () => {
					el.scrollLeft = el.scrollWidth;
				};
				pin();
				if (typeof requestAnimationFrame === "function") requestAnimationFrame(pin);
			};
		}

		/**
		 * 纵轴刻度用的紧凑金额：`$0.25` / `¥1.2`。刻度位置窄，不再补两位小数。
		 */
		function compactMoney(value, currency) {
			const n = Number(value) || 0;
			if (n === 0) return `${unitSymbol(currency)}0`;
			const abs = Math.abs(n);
			const text = abs >= 10 ? n.toFixed(0) : abs >= 1 ? n.toFixed(1) : n.toFixed(2);
			return `${unitSymbol(currency)}${text}`;
		}

		/** 通用表格。`columns` 是 `[{title, get, num}]`。 */
		function Table(React, key, columns, rows) {
			return React.createElement(
				"div",
				{ key, style: css.scroll },
				React.createElement(
					"table",
					{ style: css.table },
					React.createElement(
						"thead",
						null,
						React.createElement(
							"tr",
							null,
							...columns.map((c) =>
								React.createElement(
									"th",
									{ key: c.title, style: c.num ? { ...css.th, textAlign: "right" } : css.th },
									c.title,
								),
							),
						),
					),
					React.createElement(
						"tbody",
						null,
						...rows.map((row, index) =>
							React.createElement(
								"tr",
								{ key: row.key ?? index },
								...columns.map((c) =>
									React.createElement(
										"td",
										{
											key: c.title,
											style: c.num ? { ...css.td, ...css.tdNum, textAlign: "right" } : css.td,
											title: typeof c.get(row) === "string" ? c.get(row) : undefined,
										},
										c.get(row),
									),
								),
							),
						),
					),
				),
			);
		}

		// ─────────────────────────── 主体 ───────────────────────────

		/**
		 * 分节主体。用 hook 管理「连接状态 / 数据 / 忙碌 / 错误」四件事。
		 *
		 * @param props - 分节给的属性（含 `t`）。
		 * @param scope - 声明过依赖的子 fiber。
		 * @returns React 元素。
		 */
		function usageSection(props, scope) {
			const React = scopeReact;
			const t = typeof props.t === "function" ? props.t : (key) => ZH[key] ?? key;

			const [status, setStatus] = React.useState({ phase: "loading" });
			const [data, setData] = React.useState(undefined);
			const [busy, setBusy] = React.useState("");
			const [error, setError] = React.useState("");
			const [notice, setNotice] = React.useState("");
			const [form, setForm] = React.useState({ token: "" });
			// 回看范围：默认 1 天；快选 1 / 3 / 7 / 30 天，另有自定义天数输入框。
			const [days, setDays] = React.useState(DEFAULT_DAYS);
			/** 自定义天数的输入框草稿，回车或失焦才生效，避免每敲一个字就拉一次上游。 */
			const [customDays, setCustomDays] = React.useState("");
			/** 诊断面板：展开状态 + 拉回来的日志文本（出问题时老板自己点开就能看）。 */
			const [diagOpen, setDiagOpen] = React.useState(false);
			const [diagText, setDiagText] = React.useState("");
			/**
			 * 金额的「显示单位」。
			 *
			 * 数据里自带 `currency`（宿主半按面板的 quota_display_type 算），
			 * 这里**只认数据**。⚠️ 不要再从 snapshot 兜底：React 的 setState 若被更新函数
			 * 返回，会被当成 updater 调用传入旧值，兜底会把单位钉死成初始值。
			 */
			const unitOf = (d) => d?.currency;

			/** 读连接状态（不联网，秒回）。 */
			const loadStatus = React.useCallback(() => {
				call("GET", "/status")
					.then((res) => setStatus({ phase: "ready", ...res }))
					.catch((e) => setStatus({ phase: "error", message: String(e?.message ?? e) }));
			}, []);

			React.useEffect(() => {
				loadStatus();
			}, [loadStatus]);

			// 每次进入分节记一行：配合宿主半的「插件已挂载」行，能看出「页面重挂了几次、
			// 是不是冷启动第一次进来就这样」。
			React.useEffect(() => {
				const where = typeof window !== "undefined" && window.location ? window.location.host : "?";
				diag("ui", `进入分节（${where}）`);
			}, []);

			/**
			 * 把快照放进 ref：`loadData` 需要它来做「失败兜底」，
			 * 但**不能**把整个 `status` 写进依赖 —— 那会让 loadData 每次 setStatus
			 * 都换身份，连带把启动 effect 再触发一次，白白多打一遍上游。
			 */
			const snapshotRef = React.useRef(undefined);
			snapshotRef.current = status.snapshot;
			/** 当前选中的回看天数，也走 ref —— `loadData` 的身份必须稳定。 */
			const daysRef = React.useRef(days);
			daysRef.current = days;

			/** 读数据。`force` 传 true 时让宿主半跳过它自己的 60 秒缓存。 */
			const loadData = React.useCallback((force, rangeDays) => {
				const want = rangeDays ?? daysRef.current;
				diag("ui", `拉取数据 days=${want} force=${force ? 1 : 0}`);
				setBusy("data");
				setError("");
				call("GET", `/data?force=${force ? 1 : 0}&days=${rangeDays ?? daysRef.current}`)
					.then((res) => {
						setData(res.data);
						setNotice("");
					})
					.catch((e) => {
						setError(String(e?.message ?? e));
						// 失败时退回「上次成功」：说清这些数字是什么时候的，比一片空白有用。
						const snapshot = snapshotRef.current;
						if (snapshot) {
							setData(snapshot);
							setNotice(`显示的是上次成功获取的数据（${ago(snapshot.fetchedAt)}）`);
						}
					})
					.finally(() => setBusy(""));
			}, []);

			// 连接成功后自动拉一次。**只依赖 configured**：不把 data/busy 放进依赖，
			// 否则 setData 触发的重渲染会再进这里，形成「拉取 → 重渲染 → 再拉取」的循环。
			const bootedRef = React.useRef(false);
			React.useEffect(() => {
				if (status.phase !== "ready" || !status.configured) return;
				if (bootedRef.current) return;
				bootedRef.current = true;
				loadData(false);
			}, [status, loadData]);

			// 改天数时立刻按新范围重拉（宿主半的缓存按天数做 key，不会读到旧范围）。
			// 判据是「上次实际用的值」，所以要用一个独立的 ref 记账，不能复用 daysRef。
			const lastDaysRef = React.useRef(days);
			React.useEffect(() => {
				if (lastDaysRef.current === days) return;
				lastDaysRef.current = days;
				if (status.phase === "ready" && status.configured) loadData(false, days);
			}, [days, status, loadData]);

			/** 保存令牌：**先验证后落盘**由宿主半保证（它拿令牌打一次 /api/user/self），
			 *  这里只负责把错误显示出来。 */
			const onSaveToken = React.useCallback(() => {
				if (form.token.trim() === "") {
					setError(t("needLoginFirst"));
					return;
				}
				setBusy("login");
				setError("");
				setNotice("");
				call("POST", "/token", { accessToken: form.token.trim() })
					.then((res) => {
						setNotice(`${t("saved")}：${res.tokenHint}`);
						setForm({ token: "" });
						setData(undefined);
						loadStatus();
					})
					.catch((e) => setError(`${t("errorLogin")}：${String(e?.message ?? e)}`))
					.finally(() => setBusy(""));
			}, [form, loadStatus, t]);

			const onClear = React.useCallback(() => {
				setBusy("clear");
				call("POST", "/disconnect")
					.then(() => {
						setData(undefined);
						setNotice(t("cleared"));
						loadStatus();
					})
					.catch((e) => setError(String(e?.message ?? e)))
					.finally(() => setBusy(""));
			}, [loadStatus, t]);

			const ui = data?.user;
			const nodes = [];

			nodes.push(React.createElement("p", { key: "intro", style: css.intro }, t("intro")));
			if (notice !== "") nodes.push(React.createElement("p", { key: "notice", style: css.message }, notice));

			// ── 连接区 ──
			if (status.phase === "ready" && !status.configured) {
				nodes.push(
					Card(
						React,
						"login",
						t("loginTitle"),
						status.site,
						React.createElement("p", { key: "hint", style: css.intro }, t("loginHint")),
						React.createElement(
							"div",
							{ key: "t", style: { ...css.field, marginTop: 10 } },
							React.createElement("label", { style: css.fieldLabel }, t("accessToken")),
							React.createElement("input", {
								style: css.input,
								// 令牌是机密：用 password 型，别在屏幕上明文晾着。
								type: "password",
								autoComplete: "off",
								spellCheck: false,
								value: form.token,
								onChange: (e) => setForm({ token: e.target.value }),
								onKeyDown: (e) => {
									if (e.key === "Enter") onSaveToken();
								},
							}),
						),
						React.createElement(
							"div",
							{ key: "a", style: css.actions },
							React.createElement(
								"button",
								{ style: { ...css.button, ...css.primary }, disabled: busy !== "", onClick: onSaveToken },
								busy === "login" ? t("saving") : t("save"),
							),
						),
					),
				);
			}

			if (status.phase === "ready" && status.configured) {
				nodes.push(
					Card(
						React,
						"topbar",
						t("loginTitle"),
						text(`${t("saved")} ${status.tokenHint}`),
						React.createElement(
							"div",
							{ style: css.actions },
							// ⚠️ 文案**固定**「刷新」，不再与「刷新中…」来回切。
							//    两个文案字数不同，切换时这排按钮会整体重排；而实际刷新
							//    常常只有几十毫秒，看到的效果就是「闪一下」，比不给反馈更难看。
							//    刷新的结果由右侧那颗「缓存于 …」pill 说明，这里只需保持宽度稳定。
							//    minWidth 按 3 个字预留（14px·2 padding + 3 字），以后真要换回
							//    三字文案也不会再把后面的按钮挤动。
							React.createElement(
								"button",
								{
									style: { ...css.button, ...css.primary, minWidth: 62, textAlign: "center" },
									disabled: busy !== "",
									onClick: () => loadData(true),
								},
								t("refresh"),
							),
							// 天数快选：一排小按钮，当前选中的高亮（比下拉少一次点击，也不用展开菜单）。
							React.createElement(
								"div",
								{ style: css.segmented },
								...RANGE_PRESETS.map((r) =>
									React.createElement(
										"button",
										{
											key: r.days,
											style: { ...css.segment, ...(days === r.days ? css.segmentOn : null) },
											disabled: busy !== "",
											onClick: () => setDays(r.days),
										},
										r.label,
									),
								),
							),
							React.createElement("input", {
								style: { ...css.input, width: 62 },
								type: "number",
								inputMode: "numeric",
								min: 1,
								max: 365,
								placeholder: "天数",
								value: customDays,
								onChange: (e) => setCustomDays(e.target.value),
								onBlur: () => {
									const n = Math.min(365, Math.max(1, Math.round(Number(customDays))));
									if (Number.isFinite(n) && n > 0) setDays(n);
								},
								onKeyDown: (e) => {
									if (e.key !== "Enter") return;
									const n = Math.min(365, Math.max(1, Math.round(Number(customDays))));
									if (Number.isFinite(n) && n > 0) setDays(n);
								},
							}),
							React.createElement(
								"button",
								{ style: { ...css.button, ...css.danger }, disabled: busy !== "", onClick: onClear },
								busy === "clear" ? t("clearing") : t("clear"),
							),
							// 诊断：把宿主半记的 `diag.log` 摊开在界面上 —— 出问题时不用连电脑、
							// 不用翻 App 日志，点一下就能看到「每次请求花了多久、错在哪一步」。
							React.createElement(
								"button",
								{
									style: css.button,
									onClick: () => {
										const next = !diagOpen;
										setDiagOpen(next);
										diag("ui", next ? "打开诊断日志" : "关闭诊断日志");
										if (!next) return;
										setDiagText("读取中…");
										call("GET", "/diag?lines=120")
											.then((res) => {
												const lines = Array.isArray(res.lines) ? res.lines : [];
												setDiagText(lines.length === 0 ? "（还没有日志）" : lines.join("\n"));
											})
											.catch((e) => {
												const msg = String((e && e.message) || e);
												// 宿主半还是旧版本（没有 /diag 路由）时给一句明确的话，
												// 否则「not-found」看着像 bug。
												setDiagText(
													/not-found|404/i.test(msg)
														? "宿主半还是旧版本，重启 App 后诊断日志才会工作。"
														: `读取诊断日志失败：${msg}`,
												);
											});
									},
								},
								diagOpen ? "收起诊断" : "诊断",
							),
							// 忙碌时给一句可见的反馈：否则界面看着和平时一样，点按钮却没反应，
							// 只能说成「卡住」。配合 call() 里的 30 秒硬超时，它不会一直挂着。
							busy === "data" ? React.createElement("span", { style: css.pill }, "加载中…") : null,
							data
								? React.createElement(
										"span",
										{ style: css.pill },
										`${t("cachedFrom")} ${ago(data.fetchedAt)}${data.cached ? " · 缓存" : ""}`,
									)
								: null,
						),
					),
				);
			}

			// 诊断日志面板：等宽小字 + 可滚动。放在连接卡片下面，不打断主看板布局。
			if (diagOpen) {
				nodes.push(
					React.createElement(
						"pre",
						{
							key: "diag",
							style: {
								margin: "0 0 12px",
								padding: 10,
								maxHeight: 260,
								overflow: "auto",
								whiteSpace: "pre-wrap",
								wordBreak: "break-all",
								fontSize: 11,
								lineHeight: 1.5,
								color: "var(--dsw-alias-label-secondary, #888)",
								background: "var(--dsw-alias-bg-secondary, rgba(127,127,127,0.08))",
								borderRadius: 8,
							},
						},
						diagText,
					),
				);
			}

			if (status.phase === "error") {
				nodes.push(React.createElement("p", { key: "serr", style: css.error }, `${t("errorData")}：${status.message}`));
			}

			if (busy === "data" && data === undefined) {
				nodes.push(React.createElement("div", { key: "sk", style: css.skeleton }));
			}

			if (data !== undefined && ui !== undefined) {
				/** 美元面值 → 显示单位的乘数（宿主半已按面板规则算好，USD 站为 1）。 */
				const ratio = Number(data.priceRatio) > 0 ? Number(data.priceRatio) : 1;
				/** 分组计费倍率（与上面的金额换算倍率无关，见 ratioText）。 */
				const groupRows = Array.isArray(data.groupRatios?.groups) ? data.groupRatios.groups : [];
				// ── 余额英雄区：按面板单位主显示，另给原始 quota 作副行 ──
				nodes.push(
					React.createElement(
						"div",
						{ key: "hero", style: css.hero },
						React.createElement("span", { style: css.heroLabel }, t("remaining")),
						React.createElement("span", { style: css.heroValue }, money(ui.remainingCny, unitOf(data))),
						React.createElement(
							"span",
							{ style: css.heroRaw },
							`${int(ui.remainingQuota)} quota（${data.quotaPerUnit.toLocaleString("en-US")} / $1）· 显示单位 ${
								unitOf(data) === "CNY" ? "人民币" : unitOf(data) === "CUSTOM" ? "自定义货币" : "美元"
							}`,
						),
					),
				);

				// ── 关键数字 ──
				nodes.push(
					React.createElement(
						"div",
						{ key: "stats", style: css.grid },
						// 金额一律走 money(...)，符号跟着面板显示单位走 —— 不能直接调 usd()，
						// 那样会漏传单位、又变回 `$`（这就是上一版同一个数时而 ¥ 时而 $ 的原因）。
						Stat(React, "used", t("used"), money(ui.usedUsd * ratio, unitOf(data)), `${int(ui.usedQuota)} quota`),
						Stat(React, "total", t("total"), money(ui.totalUsd * ratio, unitOf(data)), `${int(ui.totalQuota)} quota`),
						Stat(
							React,
							"today",
							t("today"),
							money(data.usage.today.usd * ratio, unitOf(data)),
							`${int(data.usage.today.count)} 次 · ${int(data.usage.today.tokens)} tokens`,
						),
						// 主数字 = **当前范围内**的调用次数（跟着范围变）；
						// `ui.requestCount` 是账户历史总次数，跟选几天无关，只放在小字里。
						Stat(
							React,
							"requests",
							t("requests"),
							int(data.usage.totalCount),
							`累计 ${int(ui.requestCount)} 次 · ${rangeLabel(data.rangeDays)}`,
						),
					),
				);

				// ── 趋势 ──
				nodes.push(
					Card(
						React,
						"trend",
						`${t("trend")} · ${rangeLabel(data.rangeDays)}`,
						money(data.usage.totalUsd * ratio, unitOf(data)),
						Chart(React, "chart", data.usage.days, unitOf(data), data.usage.bucket),
						React.createElement(
							"div",
							{ key: "legend", style: { ...css.heroRaw, marginTop: 6 } },
							`${data.usage.days[0]?.day ?? "—"} → ${
								data.usage.days[data.usage.days.length - 1]?.day ?? "—"
							}${
								data.usage.bucket === "hour" ? "（按小时）" : data.usage.bucket === "half" ? "（按 12 小时）" : "（按天）"
							}，共 ${int(
								data.usage.totalCount,
							)} 次调用 · ${int(data.usage.totalTokens)} tokens`,
						),
					),
				);

				// ── 按模型 ──
				nodes.push(
					Card(
						React,
						"models",
						t("byModel"),
						`${data.usage.models.length} 个`,
						BarList(
							React,
							"barmodels",
							data.usage.models
								.slice(0, 16)
								.map((m) => ({ label: m.model, value: m.usd, text: money(m.usd * ratio, unitOf(data)) })),
							t("noData"),
						),
					),
				);

				// ── 令牌（API key）：表格更直观，能同时看到状态/已用/剩余/分组/**分组倍率** ──
				// ⚠️ 无限额度令牌的 remain_quota 在服务端是负数（记的是已用量），所以那列显示「—」。
				const tokenRows = data.tokens.map((tk) => ({ ...tk, rowKey: `tk-${tk.id}` }));
				/** 哪些分组是「本账号的密钥在用」的，卡片里标出来。 */
				const usedGroups = new Set(data.tokens.map((tk) => tk.group).filter(Boolean));
				usedGroups.add(ui.group || "default");
				nodes.push(
					Card(
						React,
						"tokens",
						t("tokens"),
						`${data.tokens.length} 个`,
						tokenRows.length === 0
							? React.createElement("p", { key: "e", style: css.empty }, t("noTokens"))
							: Table(
									React,
									"tbl-tokens",
									[
										{ title: t("name"), get: (r) => r.name || `#${r.id}` },
										{ title: t("group"), get: (r) => r.group || "—" },
										{
											title: t("groupRatio"),
											num: true,
											get: (r) => ratioText(groupRows, r.group),
										},
										{
											title: t("status"),
											get: (r) =>
												r.status === 1
													? React.createElement("span", { style: css.ok }, "启用")
													: React.createElement("span", { style: css.off }, "禁用"),
										},
										{ title: t("used"), num: true, get: (r) => money(r.usedUsd * ratio, unitOf(data)) },
										{
											title: t("remain"),
											num: true,
											get: (r) => (r.unlimited ? t("unlimited") : money(r.remainUsd * ratio, unitOf(data))),
										},
									],
									tokenRows,
								),
					),
				);

				// ── 分组计费倍率：站点实时全表，一眼看出每个分组多少钱 ──
				const grSource = String(data.groupRatios?.source ?? "unavailable");
				const grExtra =
					grSource === "site"
						? `${groupRows.length} 组 · ${stamp(Math.floor((Number(data.groupRatios.fetchedAt) || 0) / 1000))}`
						: grSource === "snapshot"
							? t("groupRatioSnapshot")
							: t("groupRatioUnavailable");
				nodes.push(
					Card(
						React,
						"group-ratios",
						t("groupRatioCard"),
						grExtra,
						groupRows.length === 0
							? React.createElement("p", { key: "e", style: css.empty }, t("groupRatioUnavailable"))
							: Table(
									React,
									"tbl-group-ratios",
									[
										{
											title: t("group"),
											get: (r) =>
												React.createElement(
													"span",
													null,
													r.group,
													usedGroups.has(r.group)
														? React.createElement("span", { key: "u", style: css.pill }, t("groupRatioUsed"))
														: null,
												),
										},
										{
											title: t("groupRatio"),
											num: true,
											get: (r) =>
												React.createElement(
													"span",
													{ style: r.group === "default" ? css.off : css.ok },
													ratioText(groupRows, r.group),
												),
										},
										{
											title: t("groupRatioNote"),
											get: (r) =>
												r.group === "default"
													? t("groupRatioDefault")
													: r.note || "—",
										},
									],
									groupRows.map((r) => ({ ...r, rowKey: `gr-${r.group}` })),
								),
						React.createElement(
							"div",
							{ key: "gr-hint", style: { ...css.heroRaw, marginTop: 6 } },
							t("groupRatioHint"),
						),
					),
				);

				// ── 充值记录 ──
				if (data.topups.length > 0) {
					nodes.push(
						Card(
							React,
							"topups",
							t("topups"),
							`${data.topups.length} 条`,
							Table(
								React,
								"tbl-topups",
								[
									{ title: t("time"), get: (r) => stamp(r.createdAt) },
									{ title: t("amount"), num: true, get: (r) => cny(r.money) },
									{ title: "quota", num: true, get: (r) => int(r.amountQuota) },
								],
								data.topups.map((tp, index) => ({ ...tp, key: `tp-${tp.id}-${index}` })),
							),
						),
					);
				}

				// ── 账户信息 ──
				nodes.push(
					Card(
						React,
						"account",
						t("account"),
						undefined,
						Field(React, "a1", t("username"), ui.displayName || ui.username || "—"),
						Field(React, "a2", t("group"), ui.group || "—"),
						Field(React, "a2b", t("groupRatio"), ratioText(groupRows, ui.group || "default"), true),
						Field(React, "a3", "余额（quota）", int(ui.remainingQuota), true),
						Field(React, "a4", "已用（quota）", int(ui.usedQuota), true),
						ui.affQuota > 0 || ui.affHistoryUsd > 0
							? Field(React, "a5", t("invite"), `${money(ui.affUsd * ratio, unitOf(data))}（累计 ${money(ui.affHistoryUsd * ratio, unitOf(data))}）`)
							: null,
						ui.affCode ? Field(React, "a5b", "邀请码", ui.affCode, true) : null,
						ui.email ? Field(React, "a6", "邮箱", ui.email) : null,
						Field(React, "a7", "状态", ui.status === 1 ? "正常" : `异常（${ui.status}）`),
						Field(
							React,
							"a9",
							"额度换算",
							`${int(data.quotaPerUnit)} quota/$ · 显示单位 ${
								unitOf(data) === "CNY"
									? `人民币（×${data.priceRatio}）`
									: unitOf(data) === "CUSTOM"
										? `自定义货币（×${data.priceRatio}）`
										: "美元（×1）"
							}${data.quotaSource === "fallback" ? "（站点未返回，用默认值）" : ""}`,
							true,
						),
						Field(React, "a8", "数据时间", stamp(Math.floor(data.fetchedAt / 1000))),
					),
				);
			}

			// ── 部分失败提示 ──
			if (data?.partial?.length > 0) {
				nodes.push(
					React.createElement(
						"p",
						{ key: "partial", style: css.warn },
						`${t("partial")}：` + data.partial.map((x) => `${x.part}（${x.message}）`).join("；"),
					),
				);
			}

			if (error !== "") nodes.push(React.createElement("p", { key: "err", style: css.error }, error));

			return React.createElement("div", { style: css.section }, ...nodes);
		}

		/** `text()` 的小包装，避免每个 `Card` 的 extra 都写一遍。 */
		function text(value) {
			return String(value);
		}

		let scopeReact = null;

		/**
		 * 注册设置页分节。
		 *
		 * @param ctx - 浏览器插件上下文。
		 */
		function apply(ctx) {
			try {
				scopeReact = require("react");
			} catch (e) {
				console.warn("[dsh-linksub-usage] require('react') 失败，跳过分节:", e && e.message);
				return;
			}
			if (!scopeReact) return;

			try {
				ctx.inject(["slots", "locale"], (scope) => {
					scope.effect(() => scope.locale.register(NS, { zh: ZH, en: EN }), "dsh-linksub-usage: 文案");
					const t = scope.locale.bind(NS);
					scope.slots.inject("settings.section", () =>
						scope.slots.register(
							{
								name: "settings.section",
								id: "dsh-linksub-usage",
								order: ORDER,
								label: () => t("nav"),
								locale: NS,
							},
							(slotProps) => usageSection(slotProps, scope),
						),
					);
				});
			} catch (e) {
				console.warn("[dsh-linksub-usage] 注册分节失败:", e && (e.stack || e.message || e));
			}
		}

		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	},
});
