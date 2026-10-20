# 商店文案草稿 · 0.0.2

更新：2026-10-20。以下是与当前行为对齐的文案，须在[提审门槛](READINESS.md)关闭后由发布者使用；本文件不代表已上传或审核通过。

## 通用字段

- 名称：Vigour UI Review
- 发布商名称（Publisher name）：LukiDesign
- 工程版权署名：LukiDesign
- 主语言：简体中文；英文文案不代表英文 UI。
- 建议类别：开发者工具，以后台实际选项为准。
- 首页：https://github.com/lukidesign/Vigour-UI-Review
- 支持：https://github.com/lukidesign/Vigour-UI-Review/issues
- 隐私：https://github.com/lukidesign/Vigour-UI-Review/blob/main/docs/PRIVACY.md
- 分发范围：持有人提交前确认；不把历史私享草稿视为当前公开上架状态。

## 中文简介

主动采集网页截图与 DOM/CSS，在本地对比设计图、定位视觉差异并导出报告。需安装匹配配套程序。

## 中文详情

Vigour UI Review 为设计师、前端开发和 QA 提供网页设计验收：主动采集网页，与设计图比较，将差异整理为可定位的问题和报告。

**需要单独安装并配对本地配套程序。** 扩展负责实际网页截图和结构采集，不只是工作台链接；分析引擎运行在配套程序中。当前 GitHub 渠道是 v0.0.2-beta.1 未签名预发布版，程序/扩展显示 0.0.2。提供 macOS 14+ Apple Silicon 和 Windows x64 测试包；Windows 11 真机验收仍待完成，不是稳定版。Intel Mac、Windows ARM、Linux 和 ChromeOS 不在本轮支持范围。系统或组织策略阻止安装时，请停止并反馈，不要关闭安全保护。

主要功能：

- 用户点击后采集所选网页的当前视口或整页截图，以及文字、DOM 位置和计算样式。
- 导入 PNG/JPG 设计图，在本机分析位置、尺寸、颜色、缺失和多余等视觉差异。
- 在开发图标注、平铺对比和透明度叠加三种视图中核对问题；显示/隐藏标注并定位问题。
- 保存项目和历史，导出 PNG、Markdown、JSON。
- 可选 Figma 导入、AI 问题解释和组件业务逻辑推断；AI 结果需人工核查，不自动修改代码。

流程：安装匹配程序并配对实际扩展 ID → 从工具栏打开工作台 → 展开项目栏创建项目、导入设计图 → 在获授权网页点击采集 → 从“最近采集”选择实现图 → 走查并导出。

打开弹窗会连接本地程序，点击采集才读取目标网页。截图、完整 URL、标题、文字、DOM/CSS 和采集元数据默认保存到本机；**视口模式的 DOM/文字也可能包含视口外内容**。无自动脱敏，不要采集未获授权的敏感页面。项目文件没有应用层静态加密；可选密钥使用系统凭据设施。没有产品统计或广告集成，不持续记录浏览历史。

基础像素分析在本机执行。缺少 OCR 模型时可能联网下载，不保证首次即完全离线。可选 Figma 和 AI 需要相应配置及网络；AI 每次发送前确认服务商、模型和范围，图片默认不发送，启用时发送完整标注证据图。第三方可能产生费用并按其条款处理数据。卸载配套程序保留项目及系统凭据，彻底删除方式见隐私说明。

当前 UI 主要为中文。结果用于辅助人工验收，不保证绝对准确；动态页面、超长页面、跨域 iframe、Canvas/WebGL 等可能需要人工复核。桌面工作台优先验证 1920/1440 宽度，窄屏仍有限制。

下载与限制：https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1

## English short description

Capture webpages for local design review, inspect visual differences and export reports. A matching companion app is required.

## English detailed description

Vigour UI Review helps designers, frontend developers and QA teams capture webpages, compare them with design images, and inspect visual differences.

**A separately installed, paired local companion is required.** The extension performs webpage capture; the companion runs analysis. The GitHub channel is v0.0.2-beta.1, an unsigned prerelease with application/extension version 0.0.2. Test packages are available for macOS 14+ on Apple Silicon and Windows x64. Windows 11 real-machine acceptance is pending; this is not a stable release. Intel Macs, Windows ARM, Linux and ChromeOS are outside this release's support scope. If OS or organizational security blocks installation, stop and report it; do not disable protections.

- Start viewport or full-page screenshots and collect page text, DOM geometry and computed styles.
- Import PNG/JPG design images and compare position, size, color, missing and extra elements locally.
- Inspect annotations, side-by-side views and opacity overlays; toggle markers and navigate to issues.
- Keep project history and export PNG, Markdown or JSON.
- Optionally import Figma frames or request AI explanations and component business-logic inferences. AI output needs human review and does not automatically change code.

Install and pair the matching companion to the actual extension ID. Open the workbench from the toolbar, expand the project sidebar, create a project and import a design image. Capture an authorized webpage, select it from recent captures, run comparison and export.

Opening the popup connects the companion; capture starts only after clicking a capture button. Screenshots, full URLs, titles, text, DOM/CSS and capture metadata stay on the device by default. **Viewport mode can also collect off-screen DOM/text.** There is no automatic redaction; avoid unauthorized sensitive pages. Project files have no application-layer encryption at rest; optional secrets use OS credential storage. There is no product analytics or advertising integration, or continuous browsing-history recording.

Basic pixel comparison runs locally. Missing OCR models may need downloading; first-use offline availability is not guaranteed. Optional Figma/AI features need configuration and network access. Each AI request requires confirmation of provider, model and scope. Images are off by default; enabling them sends the complete annotated evidence image. Provider charges and data terms may apply. Companion uninstall preserves project data and OS credentials; see the privacy notice for complete removal.

The interface is primarily Chinese. Results assist rather than replace human review; dynamic/long pages, cross-origin frames and Canvas/WebGL can require manual checking. Desktop checks prioritize 1920/1440 widths; narrow layouts remain limited.

Downloads and limitations: https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1

## 发布者复核

不添加“Google 认证”“保证通过审核”“100% 准确”“无任何数据处理”“全部数据已加密”“首次完全离线”“无需安装”“所有平台支持”或虚构评分/用户数。修复实现后须同步本文件、隐私政策、后台勾选及最终截图。
