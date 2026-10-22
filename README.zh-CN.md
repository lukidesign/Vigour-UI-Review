# Vigour UI Review

[English](README.md) · [下载](https://github.com/lukidesign/Vigour-UI-Review/releases) · [安装指南](docs/INSTALL.md) · [文档导航](docs/README.md) · [更新记录](CHANGELOG.md)

本地优先的 UI 视觉验收工作台：对照设计稿与 Web 实现，量化差异、走查问题并导出验收证据。

![Vigour UI Review 0.0.2：开发图标注与问题清单](docs/assets/workbench-overview.jpg)

*当前 0.0.2 工作台截图，使用真实本地分析引擎和仓库公开合成示例，不含客户数据。[截图来源记录](docs/assets/workbench-overview.json)。*

## 下载与开始使用

> **已发布测试包：Windows 为 beta.2；Apple Silicon 为 beta.1；Intel Mac 核心版为 beta.3。** 均为未签名预发布版，不是稳定版。程序和扩展显示 **0.0.2**，必须使用同平台、同次构建的配套文件。**Windows 11 复测、Intel Mac 真机验收待完成。** 各 Beta 对应不同平台，并非所有平台统一升级到 beta.3。

| 平台 | 下载 | 已验证边界 |
| --- | --- | --- |
| macOS 14+ · Intel x64 | [安装器＋扩展完整 ZIP](https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.3/Vigour-UI-Review-Setup-v0.0.2-beta.3-macos-x64-core-unsigned.zip) · [指南](docs/INTEL-MAC-TESTER-GUIDE.md) | 不含本地 OCR；原生 Intel CI 已通过；用户真机及最低系统验收待完成 |
| macOS 14+ · Apple Silicon | [图形安装器](https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.1/Vigour-UI-Review-Setup-v0.0.2-beta.1-macos-arm64-unsigned.zip) + [Chrome 扩展](https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.1/Vigour-UI-Review-extension-v0.0.2.zip) | 维护者 Mac 的核心 Chrome 流程已验证，不代表干净机器验收 |
| Windows · x64 | [测试安装包](https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.2/Vigour-UI-Review-v0.0.2-beta.2-windows-x64-unsigned.zip) | Windows Server CI 已验证，Windows 11 用户真机测试待完成 |

1. 从上表对应平台的链接下载同次构建的配套文件，验证校验和后解压。
2. 在 Chrome 中加载未打包的扩展目录，记录实际扩展 ID，并停用旧扩展，避免混用。
3. 按对应平台的安装与配对步骤打开工作台，导入设计图和开发实现图，开始走查。

发布说明、校验和及构建来源：[Intel beta.3](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.3) · [Windows beta.2](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.2) · [Apple Silicon beta.1](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1)。

请先阅读[安装指南](docs/INSTALL.md)和[测试清单](docs/BETA-TESTING.md)。不要关闭操作系统安全保护。扩展尚未在 Chrome 应用商店上架。[旧版 v0.0.1](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.1)继续保留；由于新版均为预发布，GitHub 的 Latest 标签仍指向旧版，请使用上表的平台下载链接。不要将旧伴随程序与新版扩展混用。

## 功能

- 本地 OpenCV 分析与可选 PaddleOCR；检测和评分不依赖 AI。
- 开发图标注、平铺对比、透明度叠加三种模式，支持统一标注开关及标记与问题联动。
- PNG/JPG 导入、Chrome 当前视口/整页采集，以及可选的 Figma Frame 导入。
- PNG、Markdown、JSON 导出；AI 问题解释与业务逻辑推断共用弹窗，按任务展示内容，每次请求单独授权。
- 项目与验收历史、九种内置主题及自定义主题、Native Messaging 按需启动与引导配对。

## 本地开发

以下 macOS 命令面向 Apple Silicon，需要 macOS 14+、Node.js 24+、pnpm 11+ 和 [uv](https://docs.astral.sh/uv/)。Intel 请使用不含 OCR extra 的[核心版构建指南](docs/INTEL-MAC-TESTER-GUIDE.md)；Windows 请使用 [Windows 构建指南](docs/WINDOWS-BETA-STATUS.md)。

```bash
pnpm install --frozen-lockfile
uv sync --project apps/vision-engine --python 3.12 --extra dev --extra ocr --frozen
pnpm release:check
pnpm start:local
```

可使用[公开示例图片](examples/demo)体验走查。测试、打包与目录职责见[贡献指南](.github/CONTRIBUTING.md)、[脚本索引](scripts/README.md)和[仓库结构说明](docs/architecture/REPOSITORY.md)。

```text
apps/       工作台、扩展、本地服务、视觉引擎与原生安装器
packages/   共享协议与评分逻辑
scripts/    开发、校验与打包入口
docs/       使用指南、架构、规格、发布说明与历史记录
examples/   公开合成示例
licenses/   第三方许可证原文
.github/    工作流、安全与社区协作文件
```

## 隐私与验收状态

核心对比在本地完成，无遥测。Figma/AI 为可选集成，需要用户提供凭据；AI 请求必须明确授权。凭据使用 macOS 钥匙串或 Windows 凭据管理器，本地 API 只监听回环地址。详见[隐私说明](docs/PRIVACY.md)和[安全策略](docs/SECURITY.md)。

合成基准不代表真实网站准确率。Windows 11 真机验收仍待完成；Intel Mac 核心版不含本地 OCR，用户真机与最低系统验收待完成。界面以中文为主，窄屏布局仍有限制。详细验证证据与剩余门槛见[交付记录](docs/DELIVERY-STATUS.md)和[基准说明](docs/BENCHMARK.md)。

## 参与贡献与许可

欢迎提交问题与 PR。请阅读[贡献指南](.github/CONTRIBUTING.md)及[行为准则](.github/CODE_OF_CONDUCT.md)；安全漏洞请按[安全策略](docs/SECURITY.md)私下报告。

Copyright © 2026 LukiDesign。[MIT 许可证](LICENSE) · [第三方声明](THIRD_PARTY_NOTICES.md)。
