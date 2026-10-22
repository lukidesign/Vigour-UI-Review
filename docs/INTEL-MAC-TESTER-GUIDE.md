# Intel Mac 核心功能测试包

目标：macOS 14 或更高版本、Intel 64 位处理器、Chrome。预发布标识 **v0.0.2-beta.3**；程序和扩展显示 0.0.2，需用包内 CANDIDATE.json 的标签、源码提交和构建号识别。

**未签名、未公证；Intel Mac 用户真机验收待完成，macOS 14 最低系统验收也待完成。此包不包含本地 OCR。** 不承诺 Chrome 商店审核通过。Windows 11 复测继续待完成。

## 下载与安装

2026-10-22 已公开发布。请从 [Intel 预发布页](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.3) 的 Assets 下载：

- `Vigour-UI-Review-Setup-v0.0.2-beta.3-macos-x64-core-unsigned.zip`
- `SHA256SUMS.txt`、`BUILD-PROVENANCE.json`

将文件放在同一目录，运行 `shasum -a 256 -c SHA256SUMS.txt` 校验。完整解压 ZIP，保留 `intel-stage` 目录。

1. 在“关于本机”确认处理器是 Intel，而不是 Apple M 系列。
2. Chrome 打开 `chrome://extensions`，开启开发者模式，加载包内 `chrome-extension` 文件夹，复制实际 32 位扩展 ID；停用旧版扩展。
3. 打开同目录 `Vigour UI Review Setup.app`，选择“安装 / 更新并配对”，粘贴扩展 ID。不需要自行安装 Node、Python 或复制 token。
4. 从 Chrome 工具栏的扩展打开工作台，导入两张合成或获许可的图片，选择“像素 + 结构分析”。OCR 菜单应显示当前安装包不可用。

如果被 Gatekeeper 或组织策略拦截，停止并反馈系统提示。不要关闭系统安全保护，也不要运行删除隔离属性的命令。本包未通过普通用户干净机器安装验收。

## 复测清单

- 首次安装、从真实 Chrome 扩展启动与配对。
- 当前视口、整页采集：非整数 DPR、不同浏览器缩放及长页面，检查边缘和接缝。
- 核心差异分析、三种对比模式、问题标记联动。
- PNG、Markdown、JSON 导出；Markdown 与同批次 PNG 放同一目录。
- 断网后核心图片分析正常；本地 OCR 应保持不可用，不应尝试下载模型。
- 更新、回退、修复已有配对、卸载与重装后数据保留。
- Chrome 重启、空闲和电脑睡眠恢复。
- 1920、1440、900、720 宽度下菜单及弹窗，记录屏幕缩放。

结果填写：测试人/日期、CANDIDATE.json 源码提交、macOS/Chrome 版本、Intel CPU/内存、分辨率/缩放、是否旧版升级；逐项通过/失败/未测。问题应附复现步骤、预期/实际、报错原文和截图/录屏。发送前去除客户信息，不发 token、密钥或用户数据目录。

## 构建规范

使用原生 Intel CI runner 构建并验证 x64 Node、Python、Native Host 和安装器。Python 核心依赖使用仓库锁文件及哈希，不安装 OCR extra。检查 Mach-O 架构和最低系统版本、包内路径/许可/符号链接、真实核心分析与隔离安装生命周期。CI 不等于用户真机验收。

本地 Intel 构建：安装 Node 24、pnpm 11.22.0、uv、Rust 和 Xcode 命令行工具；执行 `pnpm install --frozen-lockfile`、`uv sync --project apps/vision-engine --python 3.12 --extra dev --frozen`、`pnpm release:check`，再参考仓库 `.github/workflows/intel-mac.yml`。不要使用 Apple Silicon 指南中的 `--extra ocr`。
