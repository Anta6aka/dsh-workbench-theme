# DSH Desktop 0.2.1-rc.3 主机契约侦察（D 方向）

> 侦察时间 2026-10-26 19:37 (+08:00)｜方法：只读解析 DSH 安装目录下的 `resources/app.asar`（官方客户端包）+ 仓库源码。
> 限制：本子会话 4 次 `cordis_inspect_query`（platform=client, Theme/Slots）均 10s 超时（"Open or reconnect the Harness page"），live 值未能由我复现；结论以 asar 静态取证为准，并用 Lead 已核验的 `Theme.listTokens = 96` 做交叉印证（§2.3 公式完全吻合）。
> 证据落盘（不入仓库）：`%TEMP%\dsh-rc3-recon\{official-tokens,token-defaults,token-analysis,final-diff,palette-diff-node,bundle-scan,slot-catalog}.json`；Node diff 脚本 `palette-diff.mjs`。

## 1. 版本与安装形态（已核实）

| 项 | 结论 | 证据 |
| --- | --- | --- |
| Desktop 版本 | **0.2.1-rc.3**（`@deepseek-ai/dsh-desktop`，commit `be72761e…`，channel nightly） | `read` asar 内 `package.json` |
| Web UI 实体 | `dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/`（index.html + 主 CSS/JS） | asar 文件表 |
| 主题实现包 | `dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js`（8 张内联样式表 + ThemeRuntime + inspect 注册表） | 同上 |
| profile `desktop` 依赖 | `dsh-workbench-theme: file:<local tgz>`，且在 `dsh.profile.bundles` 中启用 | `%DSH_HOME%\profiles\desktop\package.json` |
| palette 快照 | `src/palette.mjs` 96 键，sha256 `7a25b9c1…`（Lead 并发编辑中，数字以此快照为准） | `palette-diff.mjs` 输出 |

## 2. 官方 rc.3 主题 token 全表与 diff

### 2.1 官方 token 结构（asar 静态取证）
- 全量定义 **402 个 `--dsw-*`**，来自 theme 包 8 张内联样式表：`design_platform` 190、`gradient_shadow_text` 189、`base` 10、`onboarding` 7、`focus` 1，其余 `scrollbar`/`shiki`/`corner-shape` 少量 scoped。
- `design_platform.css` = **190**：77 个 `--dsw-static-*` 原语（light/dark 各声明一次、值相同）+ **113 个语义 token**（`body` 与 `body[data-ds-dark-theme]` 各 113，必须成对覆盖）。
- **语义目标集 = 119 个"双模非 static" token**（113 design_platform + onboarding 3 + elevation 1 + linear 2）。
- 内置 inspect 注册表 `BUILTIN_INSPECT_TOKENS` 仅 **14 个**：bg-base、bg-layer-1、bg-layer-2、bg-overlay、border-l1、border-l2、brand-primary、label-primary、label-secondary、state-error-primary、state-idle-primary、state-success-primary、state-warn-primary、specific-sidebar-fill。
- `ThemeRuntime.validateOverrides` **无白名单**：任意 `--*` 名只要值形如 `{light,dark}` 即可注册（`--wb-rail`、22 个 legacy 名因此也会进 live token 列表）。

### 2.2 palette 覆盖 diff（Node 脚本，当前 palette 96 键）
| 指标 | 数值 |
| --- | --- |
| palette 键 | 96（95 官方 + `--wb-rail` 自定义） |
| 语义目标集 119 覆盖 | **73 / 119，缺 46**（46 个全部被 rc.3 bundle 引用） |
| 仅 design_platform 语义 113 | 覆盖 73，缺 40 |
| builtin 注册表 14 | 覆盖 14，**缺 0**（Lead 已补 `--dsw-alias-state-idle-primary`） |
| palette 不在 14 注册表 | 82（96 键 − 14 注册表；其中 59 个正常 alias 覆盖、22 legacy、`--wb-rail` 1） |
| palette 有、rc.3 无任何定义 | **22 legacy**：`--dsw-prototype-*` 7、`--dsw-theme-*` 14、`--dsw-alias-state-error-tertiary` 1 |
| palette 有、rc.3 bundle 零引用 | 23（22 legacy + `--wb-rail`） |

### 2.3 `Theme.listTokens = 96` 推导（与 Lead live 结果一致）
`exportInspectTokens()` = 14 builtin ∪ 主题 override 名（palette 96）∪ 已注册主题名；14 ⊂ palette → **14 + 96 − 14 = 96**。
即 live 列表包含 `--wb-rail` 与 22 个 legacy 名；它们可被 override 但不被宿主组件消费。

### 2.4 缺失 46 个语义 token（官方 light → dark 默认值见 JSON）与补值策略
| 组 | token（全部缺失） | 建议补值策略 |
| --- | --- | --- |
| 遮罩/反色 7 | bg-mask-1/2/3/drop/photo、border-inverted、border-inverted2 | 直接沿用官方默认（黑白 α，与色板无关） |
| 文件/代码 diff 8 | code-diff-added/deleted、file-diff-added-{bg,gutter,marker}、file-diff-deleted-{bg,gutter,marker} | 保留红/绿语义；用 `color-mix` 与主题底混合降饱和，官方值作 fallback |
| 文档预览/文字 9 | bg-document-preview、bg-document-selection、label-document-preview、label-shimmer、label-deep-diving(+shimmer)、markdown-code-segment-selected/unselected、markdown-placeholder | 引用型按官方 `var()` 表达式抄录（自动继承主题底）；deep-diving 蓝色系可换冷紫 |
| 菜单/浮层 6 | menu-surface-fill、menu-group-header-fill、menu-icon、specific-menu、tooltip-key-bg、toast-label | 用主题 surface + 半透明，必须与 toast/tooltip 底协调 |
| 工具栏 3 | button-tool-bar-fill / -fill-invisible / -hover | 沿用官方 α 灰（无彩色需求） |
| onboarding/渐变 5 | onboarding-card-fill / checkbox-border / secondary-fill、linear-gradient-think、linear-think-select | 低优先；抄官方表达式，确认 onboarding 首屏不突兀 |
| 其它 8 | interactive-bg-hover-danger、state-warn-secondary、switch-thumb、turn-trigger-bg(-hover)、elevation-stroke-color、specific-login-input、specific-sidebar-nav-item-active-accent | 与现有 state/interactive/switch 同值域映射 |

**补值总策略**：① 只补语义层，不覆盖 77 个 static 原语；② 引用型 token 优先照抄官方 `var()` 表达式（自动跟随主题底）；③ 显式色值用 `color-mix` 让红/绿/蓝以低饱和融入冷紫；④ 以 119-token 基线 + `node palette-diff.mjs` 做打包前检查，防版本漂移（完整默认值在 `palette-diff-node.json` 的 `semanticDiff.missing`）。

## 3. DOM / 槽位现状（rc.3）

### 3.1 live slot 目录（官方 catalog 共 103 个槽位）
`dsh-cordis-client-runner/lib/client.js` 内嵌完整槽位契约（key/kind/scope/summary/occupants/source），已抽取为 `slot-catalog.json`。

| 槽位 | rc.3 是否存在 | kind/scope | 证据 |
| --- | --- | --- | --- |
| conversation.hero.brand.mark | ✅ | single/root | catalog + conversation `HeroShell` 内 renderSlot；主题 priority -100 生效 |
| main | ✅ | keyed/root | catalog；keyed 出口直接渲染组件、无额外 DOM wrapper |
| sidebar | ✅ | single/root | catalog + ui-sidebar `SidebarRoot` 渲染 |
| sidebar.footer.action | ✅ | list/root | catalog + ui-sidebar `footArea > footerActions` |
| settings.general.item | ✅ | list/root | catalog；Settings「通用」区列表 |
| shell.overlay | ✅ | list/root | catalog + ui-layout `AppFrame.overlayLayer` |
| **workbench.brand.mark** | ❌ **不存在** | — | catalog 无此项；全 asar（2403 个 UI 包文件）0 命中 |

- **`workbench.brand.mark` 结论**：rc.3 下 `slots.inject()` 对未声明槽位是"静默等待声明"（renderer 实现：`specDynamic(key) === undefined` 时不执行 callback、不抛错）→ 该 inject **永远 inert**，不报错也不渲染；`Mark` 实际只通过 `conversation.hero.brand.mark` 与 `sidebar.brand.mark` 出现。建议删除该 inject。

### 3.2 `src/adapters/rc2.mjs` 选择器核实
| rc2 选择器/断言 | rc.3 结论 | 实际结构 |
| --- | --- | --- |
| `[data-slot="conversation.hero.brand.mark"]` | ✅ 成立 | SlotOutlet 恒渲染 `<div data-slot=… style="display:contents">` |
| `.closest('[class*="_headline"]')` | ✅ 成立 | `.WOwLGG_headline`（hash 前缀 + `_headline`，子串匹配仍命中） |
| `[class*="_titleGroup"]` | ✅ 成立 | `.WOwLGG_titleGroup` |
| `[data-slot="main"]` | ✅ 成立 | `<div data-slot="main" style="display:contents">` |
| `[data-slot="main"] > [class*="_page"]` | ✅（仅 Plugins 页） | `[data-slot=main] > section.V7pFBG_page`（keyed 出口无 wrapper） |
| `> header[class*="_pageHead"]` | ✅（仅 Plugins 页） | `.V7pFBG_page > header.V7pFBG_pageHead > h1.V7pFBG_pageTitle` |
| `_documentBar`（appearance.css:22 在用） | ❌ 不存在 | rc.3 全 asar 0 命中 |
| 任务管理（Schedule）页头 | ❌ 不匹配 | `section.olCj9W_page > div.listPane > div.pageScroll > div.pageContent > div.pageHeading`（3 层嵌套 + `<div>` 非 `<header>`） |
| 首页 hero 标题结构 | ✅ 成立 | `.WOwLGG_headline > span.WOwLGG_fishHitbox > div[data-slot=…] + span.WOwLGG_titleGroup` |

- **hero 新变化（需适配）**：titleGroup 现有 2 个直接子元素：`<span>{hero.headline}</span>` 与 `<span class="_previewBadge">{hero.preview}</span>`。rc2 适配器把 titleGroup **所有** child 标记为 `data-workbench-original-hero-copy`，会误伤 Preview 徽章 → 只处理正文 span（排除 `_previewBadge`）。
- **右侧 122px 留白前提：已不成立（语义变化）**。rc.3 是 CSS grid 三列（`sidebar | center | rightbar`，列宽内联），中央列宽度由窗口/侧栏决定；页面用 `max-width:960px` + `align-items:center` + `padding:0 clamp(24px,4vw,48px)` 居中，**没有 rc.2 式固定右侧装订线**。适配器判据 `page.right - header.right >= 122` 实际等于 `(pageWidth − headerWidth)/2`，只有**中央列 ≥ 1204px** 时才成立（1440 窗口 − 280 侧栏 = 1160 → 约 100px → 静默不显示；≥1920 窗口才出现）。rc.2 "gutter 属于页面布局"的注释在 rc.3 已不符合事实。

### 3.3 旁证：主题 CSS 里其它 rc.3 失配
- `appearance.css:20` `[data-slot=main] > [class*='_root']`：conversation 面板实为 `[data-slot=main] > [data-slot="main.conversation"] > .an3WzG_root`，多一层 outlet → **该规则 rc.3 失效**（会话背景不生效）。
- `appearance.css:18` `[data-slot=sidebar] > [class*='_root']`：sidebar root 为 `.wtg9ga_root`，是 outlet 直接子节点 → ✅ 成立。
- `appearance.css:19` `[data-slot='conversation.header']`：槽位在 catalog 中存在，但实际 header 元素类名为 `ConversationRoot_…_header`，该属性选择器能否命中需 live 复核。
- `typography.css:40/46/47` `_projectRow/_title/_time`：`_projectRow` 在 rc.3 `dsh-client-ui-workspace` 仍存在；`_title/_time` 未取证（需 live）。

## 4. rc.3 兼容风险清单（按优先级）
1. **P0** 46 个语义 token 未覆盖 → 文档预览、文件/代码 diff、菜单、tooltip、switch、turn-trigger、onboarding 仍用官方蓝/灰，与冷紫主题割裂（46 个均被组件引用）。
2. **P0** `workbench.brand.mark` 在 rc.3 不存在（inert inject，不报错但装饰缺失）。
3. **P1** `_documentBar` 规则与 `[data-slot=main] > _root` 会话面板规则在 rc.3 失效 → 文档面板/会话背景主题色丢失。
4. **P1** page-margin 立绘仅宽屏（中央列 ≥1204px）出现；窗口 ≤1484px 全部静默不显示（rc.2 条件下更宽松）。
5. **P2** hero titleGroup 新增 previewBadge，被 rc2 逻辑当作原稿文案 → 可能被替换/样式冲突。
6. **P2** 任务管理页 header 结构不同 → 该页无页头装饰（可接受则记录）。
7. **P2** 22 个 legacy token + `--wb-rail` 进入 live `Theme.listTokens`（96 中 23 个宿主不消费），增加维护噪声。

## 5. 具体修改建议

### 5.1 `src/adapters/rc2.mjs`（建议演进为 rc3 适配器）
- 保留 hero 分支的 `data-slot` + `_headline`/`_titleGroup` 子串选择器（rc.3 结构实测成立）。
- titleGroup 文案收集排除徽章：`for(const child of group.children) if(!child.hasAttribute('data-workbench-artwork-owner') && !/_previewBadge/.test(child.className)) …`。
- page 分支放宽为"页头探测"：先 `page = document.querySelector('[data-slot="main"] > [class*="_page"]')`，再 `header = page.querySelector('header[class*="_pageHead"], [class*="_pageHeading"]')`；同步适配 Schedule 页（div 页头）。
- 122px 阈值改为常量（如 `MIN_MARGIN=96`）+ 前置 `page.clientWidth>=1204` 判断；把未显示原因写入 `data-workbench-margin-skip`（gutter 不足/结构不符）便于 live 排查。
- 文件更名 `adapters/rc3.mjs`（`rc3Surfaces`），`appearance.tsx` 用 `adapters:[rc3Surfaces, rc2Surfaces]`，rc3 优先、rc2 留作旧宿主兜底。
- `appearance.tsx:82` 删除 `workbench.brand.mark` inject（或加探测，避免永久 inert 注册）。

### 5.2 `src/palette.mjs`
- 按 §2.4 分 7 组补 46 个语义 token（引用型抄官方 `var()`，显式色用 `color-mix` 融合主题底）。
- 22 个 legacy token 从 palette 移除，或迁入"仅主题 CSS 消费"的独立常量（`THEME_LOCAL_TOKENS`）；若 theme-surfaces.css/appearance.css 仍引用 `--dsw-theme-*`，保留但分组+注释。
- `--wb-rail` 保留（自定义 token，会进 listTokens 但不被宿主消费）。
- 新增 `test/palette-coverage.test.mjs`：断言 119 语义 token 全覆盖（或缺失集合 == 白名单）、palette 键 ⊆ 402 官方定义 ∪ theme-local。
- 打包前跑 `node palette-diff.mjs`（可迁入 `scripts/`，需 Lead 授权改仓库）核对 diff。

## 6. 证据与方法（可复现）
- asar 解析：前 8 字节 `[4][header_size]`，header pickle = `[payload][json_len][json]`，数据区 `8+header_size`（本机 `header_size=4748096`，数据区 4748104）；Python 脚本在 `%TEMP%\dsh-rc3-recon\`（extract_asar.py / theme_css.py / scan_bundles.py 等），不写仓库。
- 关键证据文件：`dsh-client-ui-theme/lib/client.js`（8 样式表 + 14 注册表 + validateOverrides）、`dsh-client-ui-renderer/lib/client.js`（SlotOutlet/`data-slot`、keyed 出口、`inject` 惰性）、`dsh-client-ui-conversation/lib/client.js`（HeroShell）、`dsh-client-ui-layout/lib/client.js`（AppFrame/MainPanel）、`dsh-client-ui-plugin-manager|schedule/lib/client.js`（页头 DOM）、`dsh-cordis-client-runner/lib/client.js`（103 槽位 catalog）。
- 待 Lead 补的 live 交叉验证：`Slots.listSubTree` 复核 `_title/_time`、`conversation.header` 的实际命中；确认窗口宽度下 page-margin 艺术区出现阈值。

---

## 7. Lead 处理结果（2026-10-26 19:44）

- Token：采纳"引用型抄官方 var()、显式色 color-mix 融入冷紫"策略；已补 16 个与主题观感相关的语义 token，其余 24 个功能性宿主语义（diff/遮罩/工具栏/派生别名/onboarding）明确保留官方默认，并新增 `test/palette-coverage.test.mjs`（113 语义快照 + host-owned 白名单 + legacy 清单）守护。
- 适配器：已按 §5.1 处理 hero `_previewBadge`；插件页选择器加入 `data-plugin-panel` 兜底；page-margin 改为按真实右侧留白 `>=118px`；`appearance.css` 增加 rc.3 `main.*` outlet 与会话页头背景规则。
- 槽位：`workbench.brand.mark` inject 保留——它属于可选 Workbench 导航插件声明的契约（README 记录两者可共存），在纯 rc.3 中 inert 但不报错；删除会破坏导航共存能力。
- 未采纳：文件更名 `rc3.mjs` + 双适配器并列（当前单适配器已同时覆盖两个版本，改名收益低且会牵动测试）；22 个 legacy token 移除（仍需支持声明中的 rc.2 宿主与主题自有 CSS）。
- 已知遗留：Task/Schedule 页头结构不同（无页头装饰，记录在风险）；`conversation.header` 槽位包装层需实机复核（已加双 selector）。
