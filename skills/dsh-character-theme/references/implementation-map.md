# 参考实现与改造地图

本页对应 `lucky01222/dsh-workbench-theme` 提交 `7f104df3e1779e930fbadd7e617a08563dc59ea5`，包 1.3.3、官方 Harness 0.1.7-rc.2。路径相对**主题源码仓库根目录**，不是 Skill 目录。目标版本不同，先检查现状再调整。

## 分清三类名称

| 类别 | 例子 | 新角色主题处理 |
| --- | --- | --- |
| 产品身份/私有 owner | `dsh-workbench-theme`、`workbench-theme`、`workbenchAppearance`、`workbench-appearance`、`workbench.theme-artwork` | 分配新身份，同步引用和 package lock |
| 角色内容与视觉值 | `haibara`、`Ai Haibara`、APTX、品牌文案、素材路径、`HAIBARA_TOKENS` | 按角色替换；检查分支、默认值和测试，不只改显示文本 |
| 公共协议和宿主入口 | `settings.general.item`、`workbench.brand.mark`、`data-workbench-surface`、`data-workbench-title` | 保持协议名，由目标宿主核实，不因角色变化而改名 |

`data-plugin` / `data-plugin-css` 的**值**属于当前包；属性名是 Loader 的约定，不能一起改掉。

## 改造地图

| 文件 | 负责什么 | 迁移要点 |
| --- | --- | --- |
| `package.json`、`package-lock.json` | 包名、版本、依赖、Client 注入、发布白名单 | 独立名称和初始版本；保留已核实依赖，不盲目升级 |
| `cordis.patch.yml` | Host 配置节点 | `id` 是配置身份，`name` 是包名，与代码一致 |
| `scripts/build.mjs` | esbuild 与 Client Loader 包装 | Loader id、两个 CSS owner 值均硬编码；同步新包名，保留样式插入前归属标记及 disposer |
| `src/client.mjs` | Client 注入与安装 | `slots`、`locale`、`configForms`、`theme` 是实际服务；不增加无依据的 API |
| `src/index.mjs` | schema、自动表单控制 | scene/strength/icon/reduceMotion 默认值与 UI/normalize 一致；保留自有外观表单的配置作用域 |
| `src/appearance-state.mjs` | 偏好校验、保存、历史迁移 | 新主题默认无 legacy；保留保存失败反馈、revision 冲突保护和远程连接临时偏好 |
| `src/appearance.tsx` | token、locale、表单、slots、品牌和 body 标记 | 身份、角色文案、icon 枚举和属性值同步，`native` 回退语义保留；版本标记同步新包 |
| `locale/zh.json`、`locale/en.json` | 插件元数据文案 | 与运行时 locale 一起更新 |
| `src/palette.mjs` | 语义 token 的明暗值 | 背景、正文、焦点、选中、按钮和状态色成套设计，不机械反色 |
| `src/theme-definition.mjs` | 中性位置 → 素材 variant | 改角色映射及所需布局，不改中性出口名称 |
| `src/theme-artwork.tsx`、`src/assets/` | 图片、图库、字标、签名、组件 | `ARTWORK_VARIANTS`、`imagery`、角色映射和设置图库一致；删除无用 imports/资产 |
| `src/theme-artwork.css`、`src/home-story.css` | 人物/分镜构图 | 透明边缘、避让、比例和短窗口回退；新角色不必沿用漫画或银箔 |
| `src/appearance.css`、`src/theme-surfaces.css`、`src/typography.css` | 设置、表面和文字角色 | 同步主题值选择器；不覆盖正文或编辑器 |
| `src/brand-fonts.css`、`docs/fonts/`、`scripts/fetch-brand-fonts.py` | 字体声明、来源、子集 | 新字标重新核对字符集、Unicode ranges 和许可；先读下载脚本再决定是否执行 |
| `src/browser-branding.mjs` | 浏览器标题/图标及恢复 | 保留会话前缀、自定义标题和后来 owner；官方 suffix 匹配规则不是角色名 |
| `src/title-motion.mjs`、`src/glyph-contours.mjs` | 按真实字形测量的动效 | 无装饰/触屏/减少动态/失焦/卸载时保留静态文字，不给字标祖先加旋转缩放破坏测量 |
| `src/artwork-projection.mjs`、`src/shadow-artwork.mjs` | 出口发现、门户及 open Shadow 生命周期 | 只认显式中性出口，保留去重清理；Shadow CSS 转换器硬编码去除 haibara 选择器，需同步新角色值 |
| `src/adapters/rc2.mjs` | rc.2 有限 DOM 适配 | 版本绑定；未知结构跳过，不扩大选择器覆盖任意页面 |
| `docs/appearance-contract.md`、`docs/contracts.d.ts` | 通用外观契约 | 按协议接入，不要求业务插件依赖角色主题包 |

## 身份与迁移陷阱

参考状态创建为：

```js
appearanceState(
  ctx.configForms.get('workbench-theme'),
  ctx.configForms.get('workbench-shell'),
)
```

这是旧导航外观偏好向灰原哀主题的一次迁移，**不是新角色主题初始化办法**。例如用户选择原创星旅者、Cordis id 为 `theme-star-traveler`，应使用：

```js
appearanceState(ctx.configForms.get('theme-star-traveler'))
```

仅在用户明确要求迁移时，按真实旧配置设计字段映射。schema 枚举变动须同步 `DEFAULT_APPEARANCE`、`choices`、`normalizeAppearance`、UI 保存值和迁移测试。新 icon key 不能被 normalize 静默折回 `aptx`。

`BrandWordmark` 仅对 `比护的 AI 工作台` / `Bihu AI Workbench` 做特定拆分，其他名字使用单段回退。新字标须明确结构及完整 accessible name。浏览器标题投影中的 `DeepSeek Harness` 是官方 suffix 匹配目标，应保留。

参考 favicon 直接处理单色 SVG 的 fill/stroke；新标志是彩色时重新核对，不能机械沿用单色着色规则。字体子集仅覆盖原字标，新角色字样必须补全。

以下搜索帮助定位；逐项判断归属，不直接全局替换：

```sh
rg -n 'dsh-workbench-theme|workbench-theme|workbenchAppearance|workbench-appearance|workbench\.theme-artwork' package.json package-lock.json cordis.patch.yml src scripts test locale
rg -n 'HAIBARA|haibara|Haibara|APTX|aptx|比护|Bihu' src scripts test docs locale README.md THIRD_PARTY_NOTICES.md
```

历史来源/版权署名可保留原名；实际文案、运行默认值和新构建产物不应夹带旧角色内容。

## 精简素材与清理不能只照抄

只有标志或少量素材时，删除 variant/role 后还要检查调用方。参考 `src/adapters/rc2.mjs` 在 active 时直接读取 `roles['home-heading']` 和 `roles['page-heading']` 并创建 art 门户，没有检查它们是否存在。删掉这些映射却保留调用，会把 `undefined` 传给素材组件，并在 `variant.startsWith(...)` 等分支失败。新实现应只为确有映射的位置创建门户，或同步删除不再需要的适配分支；素材组件也应对未知 variant 保持空白回退。验证缺省角色、设置预览、图库与无装饰，而不只验证素材齐全的首页。

参考代码的恢复路径也不是所有权检查的完成证明。例如 `src/appearance.tsx` 的 body 标记清理直接写回先前值，未比较当前值是否仍为自己最后应用的值；`artwork-projection.mjs` 也有直接恢复属性的路径。新主题沿用这些机制时，记录 original/applied，并仅在当前值仍由本主题持有时恢复；若其他 owner 后来已写入，应保留后来值。为这个场景保留行为测试，不把“有 disposer”写成“不会覆盖其他 owner”。

## 公共协议与版本边界

- `ctx.theme.overrideTokens(source, pairs)` 注册 light/dark 层，disposer 释放本层，source 用新包名。它不是主题互斥选择器。
- `ctx.slots.inject/register` 随槽生命周期注册。官方品牌槽为 `conversation.hero.brand.mark`、`sidebar.brand.mark`；`workbench.brand.mark` 是**导航插件声明**的可选槽，非官方内建。
- `settings.general.item` 放外观设置，`shell.overlay` 放主题 Portal。新主题改条目 id，不改宿主槽名。
- `data-workbench-surface-root="open"` 与 `workbench:surface-root-ready` 是显式参与协议；不遍历 closed/未声明根，不重挂正文或编辑器。
- `--dsw-alias-*` / `--dsw-specific-*` 是语义 token，`--dsw-theme-*` 是兼容补充；硬编码第三方颜色和任意 iframe 不会自动跟随。
- rc.2 适配器、原生/Shell/Office CSS 选择器、持久 title 与官方品牌后缀、Loader 包装均有版本假设，升级后核验。

body/Shadow 属性、出口 active 属性、门户类名、字体 alias 和浏览器品牌存在共享资源。改包名不消除这些冲突；默认一次只启用一个角色主题，切换前停用旧主题并验证恢复。

## 验证与安装

正常先构建，再检查和测试；字体/生命周期测试会读取 dist。当前没有 `typecheck` script，不编造命令。

```sh
npm ci --omit=peer
npm run build
npm run check
npm test
DSH_RUNTIME_ROOT=/path/to/official-runtime \
DSH_PEER_PACKAGE_ROOT=/path/to/built-shell \
npm run test:client
npm pack --dry-run --json
npm pack
```

新包运行前适配 `test/client/style-lifecycle.test.mjs` 的 `readPackage()` 白名单、`counterpart` 判定、品牌断言、配置和 CSS fixture 身份，指向**新主题与真实导航**这一对。保持真实 Loader/Cordis 的样式归属、HMR、停用恢复断言，不能只删白名单限制。`DSH_RUNTIME_ROOT` 指向含 node_modules 的官方运行目录。`npm test` 不运行这组集成测试；两者也不代替浏览器验收。

单元测试覆盖 palette、appearance、migration、artwork、shadow、lettering、fonts、motion 和 lifecycle。按新规范更新输入和身份断言，保留行为目标。

仅在已授权的隔离环境使用以下形式，包路径替换为实际构建产物：

```sh
DSH_HOME=/path/to/isolated-home dsh plugin --profile web add /path/to/new-theme.tgz
DSH_HOME=/path/to/isolated-home dsh web --host 127.0.0.1 --port 0 --no-open
```

从独立空工作目录启动，避免加载当前目录的 .env。使用该进程打印的完整登录 URL，画面和公开文档不含其 token。不要为演示关闭认证或修改日常服务。

检查真实 tarball 的入口、素材、字体、许可和大小。仓库 `skills/` 不在当前 npm 的 files 白名单内：Skill 分发与 npm 插件安装是两件事。
