# 商店文案草稿

使用前提：最终 Native 安装包和真实 Chrome 闭环验收完成。当前不能提前宣传为正式稳定版。

## 通用字段

- 名称：Vigour UI Review
- 发布商名称（Publisher name）：LukiDesign
- 工程版权署名：LukiDesign
- 主语言：简体中文
- 类别建议：开发者工具，以后台现有类别为准
- 首页：`https://github.com/lukidesign/Vigour-UI-Review`
- 支持：`https://github.com/lukidesign/Vigour-UI-Review/issues`（拟用）
- 首轮分发：Private，指定测试人员

## 中文简介

采集网页截图与 DOM/CSS，连接本地工作台对比设计稿、定位视觉差异。需要安装配套程序。

## 中文详情

Vigour UI Review 帮助设计师、前端开发和 QA 对照设计稿检查网页实现，把视觉差异整理成可定位的问题清单。

使用前需要安装匹配的本地配套程序。首轮内测面向 Apple Silicon Mac；仅安装扩展不能独立完成图像分析。

主要功能：

- 主动采集当前视口或整页截图，以及用于验收的页面结构和计算样式。
- 上传 PNG/JPG 设计图，在本地工作台进行像素与结构辅助检查。
- 用开发图标注、左右平铺、透明度叠加三种方式核对差异。
- 查看位置、尺寸、颜色等问题，辅助理解偏移与大小变化。
- 保存项目与验收历史，导出标注 PNG、Markdown 或 JSON。

流程：安装并配对程序 → 从扩展打开工作台 → 创建项目并上传设计图 → 采集目标网页 → 在“最近采集”选择实现图 → 运行分析。

截图、所选页面 URL、文字及 DOM/CSS 默认保存在本机，请先隐藏敏感内容。代码未集成产品统计或广告 SDK，不持续记录浏览历史。像素分析在本机进行；缺失 OCR 模型时可能首次下载。可选 Figma 和 AI 需要联网、配置与相应操作；AI 外发逐次确认。

结果是辅助验收证据，不是无误差的质量认证。动态内容、超长页面、跨域 iframe、Canvas、WebGL 等可能需要人工复核。当前界面以中文为主，桌面工作台优先适配 1920×1080；窄屏布局仍在完善。

## English short description

Capture webpages for local design review. Compare screenshots and inspect visual differences. A companion app is required.

## English detailed description

Vigour UI Review helps designers, frontend developers and QA teams compare design images with implemented webpages and inspect visual differences in a local workspace.

A matching local companion app is required. The first private beta targets Apple Silicon Macs. The extension alone does not provide the analysis engine. The current interface is primarily in Simplified Chinese.

- Capture the current viewport or a full page after you explicitly start a capture.
- Collect the selected page's screenshot, URL, text, DOM geometry and computed styles for review.
- Compare PNG/JPG design images with implementation screenshots locally.
- Inspect annotated results, side-by-side views and opacity overlays.
- Review position, size and color differences, keep project history, and export PNG, Markdown or JSON reports.

Install and pair the companion, open the workbench from the extension, create a project, add a design image, capture the target page, select it from recent captures, and run analysis.

Captured review data stays on your device by default. Hide sensitive content before capture. There is no product analytics or advertising integration, and no continuous browsing-history recording. Pixel analysis runs locally; missing OCR models may need an initial download. Optional Figma imports and AI explanations require network access and configuration. AI transfers require per-request confirmation.

Results support human review rather than guarantee pixel-perfect correctness. Dynamic pages, long pages, cross-origin frames, Canvas and WebGL can require manual checking. The desktop workbench prioritizes 1920×1080; narrow-screen layouts are still being improved.

## 禁用的宣传承诺

不要添加“100% 准确”“首次完全离线”“无需任何安装”“所有系统支持”“Google 认证”“自动修复代码”，或虚构用户量、评分与排名。
