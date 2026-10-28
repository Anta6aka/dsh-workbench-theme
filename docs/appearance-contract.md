# 通用外观协议 v1

颜色和装饰是可选能力。业务插件不引用主题包运行代码，不要求主题插件存在，也不选择某个角色、图片或主题名。

## 共享颜色与控件

优先复用官方 UI Primitives 和 `--dsw-alias-*`、`--dsw-specific-*` 语义变量。主题向官方 ThemeRuntime 注册包含 light/dark 的颜色层，原生 ThemePresenter 统一刷新页面。颜色层的 disposer 只释放自己的层，不撤销其他主题或用户选择的明暗模式。

`--dsw-theme-panel-surface`、`--dsw-theme-sidebar-surface` 等现有工作台变量作为兼容补充；新业务组件以官方语义变量为主。任意第三方硬编码颜色不会自动转换。Shadow DOM 使用浏览器原生的自定义变量继承，避免复制某个主题的色值；iframe 需主动接入通用外观快照，不直接注入任意页面。

## 材质与层级（1.4.0-custom.2）

主题在语义颜色之上增加一层轻量材质：画布/会话/侧栏使用低透明度多层径向渐变（弥散环境光），输入卡与会话页头使用半透明填充 + 顶部高光 + 分层阴影（玻璃薄层）；`--dsw-elevation-soft/panel/prominent` 与 `--dsw-focus-ring-color` 由主题覆盖为同一套冷紫/黑层级。输入卡刻意不使用 `backdrop-filter`：filter 会让 fixed 定位的子弹层以卡片为坐标系（参考 Endfield 的实机记录）。材质层全部是主题自有 CSS，不改变业务组件的结构与交互；停用主题即整体移除。

## 可选装饰位置

| `data-workbench-surface` | 语义 | 建议的安全空间 |
| --- | --- | --- |
| `home-heading` | 首页欢迎区域 | 自有标题旁的空白区域 |
| `page-heading` | 通用页面标题区 | 标题和工具栏之外 |
| `page-margin` | 页面外侧留白 | 宽屏且实际留白不少于 122px；不得挤占内容 |
| `sidebar-footer` | 侧栏底部空白 | 190px；短窗口允许隐藏 |
| `assistant-header` | 助手顶部装饰带 | 71px；短窗口可降至 48px |
| `settings-heading` | 设置区域装饰带 | 主题自己的设置区使用 74px |
| `assistant-empty` | 助手空状态的留白 | 由业务在真实空状态中声明；本版不侵入工作室业务 |
| `collection-heading` | 资料集合标题旁的留白 | 72×30px；窄容器隐藏，保留标题与控件 |
| `original-empty` | 原件集合的真实空状态 | 200×142px；保留上传按钮、说明和原有空状态 |
| `preview-empty` | 原件没有可用在线预览的留白 | 190×142px；保留文件标题、下载与文件信息 |

```html
<div class="artOutlet" data-workbench-surface="sidebar-footer" aria-hidden="true"></div>
```

```css
.artOutlet { display:none }
.artOutlet[data-workbench-artwork-active] { display:block; height:190px; overflow:hidden }
```

出口应专用于装饰，默认空且不占空间，不放交互元素。出口的位置和空间由业务布局提供；主题从自身定义中选择构图并用 React Portal 追加内容。`data-workbench-artwork-active` 是主题所有的激活标记，业务只读取它。无主题、无装饰、无匹配角色时均不保留空间。新插入、角色变化、移除、应用切换和停用均受观察器管理，主题卸载清理所有自有门户和标记。装饰不拦截点击。

## 可选的 open Shadow 根

业务可在创建 Shadow DOM 的宿主元素上声明 `data-workbench-surface-root="open"`，并在根与展示出口准备好后从宿主发送一次冒泡的 `workbench:surface-root-ready` 事件。主题后装也会发现已有声明；主题同时监听 document 和每个参与的 open 根，因此嵌套根也兼容已有的仅 `bubbles:true` 事件。事件重发不会重复观察器、CSS 或门户；业务重建根内 HTML 后会重新挂入主题拥有的同一份 CSS。未声明、closed 或已经卸载的根不会被访问。

```js
host.setAttribute('data-workbench-surface-root', 'open')
const root = host.attachShadow({ mode: 'open' })
// 添加业务自己的 HTML、CSS 和空的中性出口。
host.dispatchEvent(new Event('workbench:surface-root-ready', { bubbles: true }))
```

主题只在明确的展示出口追加装饰，并在参与的根中拥有一份素材 CSS。私有的 `data-workbench-artwork-*` 宿主标记控制明暗、展示强度和减少动态效果，不覆盖业务本身的外观标记。关闭装饰会撤回 CSS、门户和自有标记；根移除或取消声明时取消对应观察器，主题卸载撤回全部资源并恢复原属性。正文、图谱、文件输入、滚动和草稿均不重挂载。无需业务引用主题包、图片或人物名，也不向主题传输资料。

## 可选品牌槽

导航的 `shell.overlay` 条目声明子槽 `workbench.brand.mark`：single/root，owner 为 `{size, className?}`。没有主题贡献时使用官方 FishLogo fallback。主题通过 `slots.inject()` 在每次槽声明生命周期中注册贡献；后装、停用导航与重新启用无需重装主题，也不争夺宿主父槽所有权。

## 可选标题动效

纯文本标题可声明 `data-workbench-title`。原文、字体、字号、位置和无障碍名称保持；主题追加一份 `pointer-events:none` 的自有 Canvas，不把原文拆成节点或改变选区。有交互/可编辑祖先、交互子节点、超过80字、多行、RTL或图形上下文不可用时保持静态原文。

每个原生字形以 DOM Range 测得位置，并使用同一字体生成实际字形轮廓锚点。鼠标经过时只启动该字的描边和锚点；停留后保持 active，指针离开500ms后顺次恢复填充。相邻字各自维护状态，快速返回可中断退出；没有整段标题跟随位移或反复重播。锚点以35ms间隔出现、大点90ms后缩小，大点上限2.8px，小点0.8–1.2px；绘制仅发生在状态过渡，不在停留或闲置时持续运行。设置重播是显式预览，不自动替代鼠标响应。

文本/字体/布局改变、滚动离屏、失焦、隐藏、减少动态效果、无装饰、触屏与停用时，取消队列与计时器，恢复原文字颜色并重新量测。卸载移除Canvas、自有类名、监听与属性；外部写入的样式优先。标题内容只在当前页面绘制，不向主题Host或外部传送。

首页的 `Ai Haibara` 是既有插兜立绘组件的可选签名动效；只有首页出口传入 `motion="home"`。签名保持单行纯文本和原生斜体字体，文字与其自有祖先不旋转或缩放，避免原生 Range 与 Canvas 的坐标差异；文字阴影关闭，保证进入轮廓状态后没有实心残影。鼠标命中只开放签名文字盒，素材组件及其他图像保持不拦截点击。图库、设置按钮和其他同素材出口不自动启用签名动效。

主标题的 CJK 与普通 Latin 词组使用本地 `Workbench Display Serif`（Noto Serif SC 600）；AI 重音及签名使用 `Workbench Signature`（Cormorant Garamond 600 Italic）字体子集。子集覆盖现有中英文品牌文案，不用于正文；新增或修改字标文案时须同步更新字体子集。支持 CSS Font Loading API 时，字体未就绪或检查失败会保留原生可读字形，加载完成使旧测量失效，字体就绪后才开始轮廓绘制；不具备该 API 的旧环境沿用原生字体与尺寸检测。两个字标使用独立明暗配色，不改变应用的全局品牌色和正文控件字体。

## 宿主版本适配

`conversation.hero.brand.mark` 是公开槽位，用于首页标志；`src/adapters/rc2.mjs` 同时覆盖已核实的 rc.2 与 rc.3 结构，未知结构跳过。rc.3 的首页标题仍是 `_headline > _titleGroup`，但 `_titleGroup` 新增了 `_previewBadge` 子元素，适配器只把原稿文案（非徽章）标记为可隐藏；插件管理页的页根在 rc.3 带 `data-plugin-panel` 且仍为 `header._pageHead > h1`；右侧边饰改为按页面真实右侧留白（≥118px）判断，不再假设 rc.2 的固定装订线；会话面板在 rc.3 多一层 `main.*` 出口，背景规则同时匹配两种嵌套。原生子节点保留，停用后恢复原文字；不重写会话、输入框、页面操作或业务数据。浏览器标题后缀与 favicon 自 1.4.0 起不由主题接管。

## 字标排版角色（1.3.1 本地精修）

当前首页字标把中文名称、连接词、AI 和工作台作为连续原文中的显式文字片段；外层是一个具有完整文案 accessible name 的 heading，各片段对辅助技术隐藏以避免重复朗读。中文字形保留 Noto Serif SC 600，AI 采用 Cormorant 真斜体与签名同一暖色重音，连接词略小。各片段分别声明 `data-workbench-title`，已有纯文本逐字 Canvas 算法不改变。任意其他本地化品牌文案保持单段原文，不自动拆解。

`src/typography.css` 是主题自有的角色层：字标、重音、UI、元信息。当前值来自真实样张比较而非通用比例法则；不改全局 body 字体、不覆盖用户正文、Univer canvas 或文档存储样式。字体仍是固定字标子集，签名字体输入更新为 `AI Ai Haibara`，合计 5,048 bytes，新增 I 字形成本52 bytes。未知官方/Shell/Office结构不强制应用具体角色规则。
