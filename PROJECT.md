# DSH 灰原哀主题 · 本地接管优化项目

基于 [lucky01222/dsh-workbench-theme](https://github.com/lucky01222/dsh-workbench-theme) v1.3.4 源码（MIT）的本地定制分支。
目标：长期维护一个更克制、更精致、兼容当前 DSH `0.2.1-rc.3` 的版本。

## 当前状态

- [x] 源码就位（v1.3.4），构建链路跑通：`npm ci --omit=peer` + `npm run build` → `dist/client.js`（约 1.88 MB）
- [x] 官方 v1.3.4 已装进 desktop profile 并启用（带精确版本豁免 `0.2.1-rc.3`）
- [x] 第一版定制完成（A 克制 + B 精致 + D 兼容，见 `CHANGELOG.md` 1.4.0-custom.1）
- [x] 第二轮热门开源项目借鉴（弥散环境光、玻璃薄层、Hero 光晕、分层阴影/焦点环、设置强度条，见 1.4.0-custom.2）
- [x] `engines.dsh` 声明 `0.2.1-rc.3`，安装本地版不再需要豁免
- [x] 补齐 89/113 个 rc.3 语义 token；功能性宿主语义保留官方默认并用测试守护
- [x] rc.3 DOM 适配（hero previewBadge、插件页页根、page-margin 留白、会话面板/页头背景）
- [x] 安装本地版替换官方版并完成实机截图验收（浅色/深色 × 首页/会话/插件页/设置页）
- [ ] 第二版：C 设置项（预设/主题色/浏览器标签开关）、E 素材瘦身、F 工程补齐

## 目录

```
src/            主题源码（React + esbuild，client.mjs 入口）
scripts/        构建脚本、桌宠语音/工作桥、素材转换脚本
dist/           构建产物（已 gitignore，构建生成）
pet-data/       灰原哀桌宠数据（配置 + 35 个规范动画 + 记忆），已 gitignore
assets/         表情包源 GIF 与主题素材
docs/           优化方案与开发记录
media/ locale/  README 截图与上游自带资源
```

## 开发工作流

```powershell
npm ci --omit=peer              # 首次
npm run build                   # 改完 src 后构建 → dist/client.js
npm pack                        # 产出 dsh-workbench-theme-1.4.0-custom.N.tgz
```

安装（不要手改 profile）：

```
plugin_manager install_bundle → target 指向本目录绝对路径（或 npm pack 出的 tgz）
```

每次改动 = build → install → 重启 DSH 验证（客户端主题需要重载）。

## 回滚

- 不保留旧 tgz 存档；回滚通过 `plugin_manager` 重新安装官方包或指向本目录源码。
- 桌宠只保留 `haibara` 一个角色，默认宠物配置已清空（`pets: []`）。

## 开发约束

- 只改本仓库源码，不直接改 `%DSH_PROFILE_DIR%` 里的文件（安装交给插件管理器）。
- 角色图片/字体等素材版权归原权利方，仅个人使用；不新增对外分发。
- 保留上游 MIT 许可与 `THIRD_PARTY_NOTICES.md`；我们的改动在 `CHANGELOG.md` 追加。

## 相关

- 优化方案：`docs/plan.md`
- 上游仓库：https://github.com/lucky01222/dsh-workbench-theme
