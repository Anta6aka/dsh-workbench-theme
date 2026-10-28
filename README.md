# 灰原哀工作台 · DeepSeek Harness

基于 [lucky01222/dsh-workbench-theme](https://github.com/lucky01222/dsh-workbench-theme) v1.3.4 的本地定制版，适配 Desktop **0.2.1-rc.3**。上游提供主题基座；这个 fork 主要新增的是**独立桌宠、聊天语音/记忆，以及六区工作台**。

![桌宠动作演示](media/pet-demo.gif)

> 为避免泄露真实工作区，README 不展示会话侧栏、费用和聊天记录截图；只保留桌宠动作素材。

## 相比上游新增了什么

### 1. 独立的网页桌宠

- `pet-engine/` 独立引擎，不做桌面窗、托盘或系统悬浮；
- 浮层拖拽、贴边探头、上下拖动、收回/出现动画；
- 动作画廊、点击/右键菜单、表情联动；
- 启动问候、低频自动说话；聊天时自动安静；
- 不依赖角色主题也能单独运行。

### 2. 语音、聊天、记忆和语气

- GPT-SoVITS 日语语音 + 中文字幕；未配置 TTS 时自动禁用语音，不影响桌宠；
- 聊天卡：真实模型回复，不是预设台词；
- 三级记忆：global / project / session，可手动增删置顶；
- 按会话注入小哀语气：当前对话 > 项目默认 > 全局默认；
- `haibara-pet-host` 负责把 DSH 的 LLM、语音、记忆和设置桥接到本地引擎。

### 3. 六区工作台（独立插件）

`plugins/workbench-zones`：

- 六区视图：资料 / 想法 / 待办 / 当前档期 / 验收 / 归档；
- 便签收件箱：Alt+N，四问、进想法库、进待办、现在做；
- 当前档期主批次 WIP=1，槽满自动落待办；
- 项目数据本地 JSON，单一源。

> 六区面板截图同样省略；功能和入口见下文。

### 4. 界面细节

- 对话区背景图 `chat-bg-1/2/3`，随明暗主题切换；
- 输入框台词引用：每日轮换 / 固定 / 自定义，带出处 tooltip；
- 欢迎区立绘可选：设置 → 通用 → 外观 → 「欢迎区立绘」，十种构图直接切换；
- 浏览器标题保持原生 `DeepSeek Harness`，不改写 favicon。

## 和上游的关系

- 主题外观、字标、部分构图和原始 README 结构来自上游 v1.3.4（MIT）；
- 上游最后更新停在 v1.3.4（2026-10-16），本仓库是本地延伸，不等待上游；
- 桌宠、语音、聊天记忆、六区、便签和 `workbench-zones` API 是本地新增；
- 上游完整说明见 [上游 README](https://github.com/lucky01222/dsh-workbench-theme)；本 README 只讲差异。

## 安装

```sh
npm ci
npm run build
node plugins/workbench-zones/scripts/build.mjs
npm pack   # dsh-workbench-theme-1.4.0-custom.4.tgz
```

1. 在 DeepSeek Harness 桌面版「插件 → 添加插件」安装主题 tgz；
2. 用插件管理器安装 `plugins/workbench-zones` 和 `plugins/haibara-pet-host`；
3. 完全退出并重新打开 DSH；
4. 进入 设置 → 通用 → 外观，选择明暗、欢迎区立绘和桌宠开关。

桌宠语音需要本机 GPT-SoVITS `127.0.0.1:9881`；不配置只会没有语音。Python/Pillow 路径和 TTS 配置可用 `pet-data/local-env.json` 覆盖（已忽略，不提交）。

## 素材与许可

- 代码：MIT；
- 角色图片、动画和截图中的角色：版权归读卖电视台、小学馆、TMS 等原权利人，不属于 MIT；
- 表情包来源：B站《[小柯小哀表情包分享](https://www.bilibili.com/video/BV1NkhU6oExk/)》；
- 如有侵权，请联系仓库作者，确认后会立即删除或替换。

完整声明：[NOTICE.md](NOTICE.md) · [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) · [素材来源](docs/ASSET_SOURCES.md)。

## 致谢与引用

- **主题基座**：[lucky01222/dsh-workbench-theme](https://github.com/lucky01222/dsh-workbench-theme) v1.3.4（MIT，代码 fork，保留上游 LICENSE）；README 结构也改写自上游。
- **工作台导航**：[lucky01222/dsh-workbench-shell](https://github.com/lucky01222/dsh-workbench-shell)，紧凑应用栏和布局参考。
- **早期桌宠灵感**：社区 `dsh-pet`（大肥鱼）与 `bailong-desktop-pet`，仅交互参考，不包含其代码或素材。
- **平台**：DeepSeek Harness / `@deepseek-ai/dsh` 与 Cordis 插件系统，感谢 Slots、Theme、Host、WebServer 接口。
- **表情包**：B站《小柯小哀表情包分享》，感谢分享者。

## 验证

```sh
npm test             # 74 passed, 7 skipped (requires local services/client environment)
npm run smoke:auth   # 本地 token/Referer 契约
```

UI、语气 A/B 和真实会话隔离仍在持续验收。
