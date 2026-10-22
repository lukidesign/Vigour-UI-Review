# Apple Silicon beta.4 安装与复测

目标：M 系列 Mac（arm64）、macOS 14+、Chrome。发布渠道 **v0.0.2-beta.4**，程序和扩展显示 **0.0.2**；用 `CANDIDATE.json` 的标签、源码提交和构建号区分本次包。

**未签名、未公证；本次包的真实 Chrome、干净机、最低系统、空闲/睡眠及离线 OCR 验收待完成。** 10 月 19 日维护者本机 beta.1 流程记录不能替代 beta.4 复测。Windows 11 和 Intel 真机验收也继续待完成。

## 下载与安装

从 [beta.4 发布页](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.4) Assets 下载实际列出的附件；未列出时代表尚未交付，不使用 CI 临时文件替代：

- `Vigour-UI-Review-Setup-v0.0.2-beta.4-macos-arm64-unsigned.zip`：完整包，包含安装器和同次构建扩展。
- `SHA256SUMS.txt`、`BUILD-PROVENANCE.json`：校验和与来源记录。高级用户可将附件放在同目录执行 `shasum -a 256 -c SHA256SUMS.txt`；需要帮助时联系发布者。

1. 在“关于本机”确认是 Apple M 系列芯片，不是 Intel。
2. 完整解压，保留 `arm64-stage` 目录。先完成或取消旧版正在运行的任务；升级前在程序关闭后备份自己的项目数据，不将备份上传到公开反馈。
3. 在 `chrome://extensions` 停用旧扩展，开启开发者模式，加载包内 `chrome-extension` 目录，复制实际 32 位 ID。不要使用 beta.1 / Windows / Intel 的扩展目录替代。
4. 打开同目录 `Vigour UI Review Setup.app`，选择安装/更新并配对，填写新的实际扩展 ID；不必安装 Node/Python 或手动复制 token。
5. 从新扩展打开工作台，确认旧项目、历史结果和图片保留，关闭旧工作台标签，重新刷新准备采集的网页。

若 Gatekeeper 或组织策略阻止运行，停止并反馈提示。不要关闭安全保护、删除隔离属性或降低安全设置。本版升级新增采集状态数据库字段；隔离测试中的“回退”仅指相同数据库结构的版本，**不保证升级后直接回退 beta.1**。

## 复测重点

- 旧项目、历史结果、问题编号、图片和导出在升级后可读取；不要用真实客户数据公开反馈。
- Chrome 视口/整页采集，尤其不同浏览器缩放下的非整数 DPR、长页面接缝与右边缘。
- 处理失败不误报完成；最近采集显示失败原因，未就绪的截图不能用于分析。
- 三种对比模式、标注显隐与问题跳转；PNG、Markdown、JSON 导出。Markdown 与同批 PNG 放在同一目录。
- 保留 PaddleOCR 依赖，不是 Intel 的无 OCR 核心版。能力探测通过只代表依赖可加载，不代表模型已缓存或离线识别通过；OCR 首次使用可能联网下载模型，按隐私说明取得许可后单独测试。
- 重启 Chrome、连续采集 20 次、空闲退出、睡眠恢复、修复配对、卸载/重装后数据保留。
- 断网使用已有图片验证核心分析；OCR 单独记录通过/失败/未测，不以核心分析成功代替。

通用回传字段见 [测试模板](BETA-TESTING.md)，渠道填写 `Apple Silicon v0.0.2-beta.4`。请附最小复现步骤、系统/Chrome 版本、屏幕与浏览器缩放、错误原文及脱敏截图，不发送 token、密钥或完整用户数据目录。
