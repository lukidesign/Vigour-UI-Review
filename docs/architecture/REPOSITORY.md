# 仓库结构与维护约定

本项目采用 pnpm 多包仓库。应用放在 `apps/`，共享逻辑放在 `packages/`；文档整理不改变这些边界。

## 目录职责

| 路径 | 内容 |
| --- | --- |
| [apps/workbench](../../apps/workbench) | Vue 工作台 |
| [apps/chrome-extension](../../apps/chrome-extension) | Chrome 采集扩展 |
| [apps/local-service](../../apps/local-service) | 本地 API、存储与可选集成 |
| [apps/vision-engine](../../apps/vision-engine) | Python 视觉分析与基准 |
| [apps/native-host](../../apps/native-host) | Native Messaging 主机 |
| [apps/companion-installer](../../apps/companion-installer) | 伴随程序安装器 |
| [packages/contracts](../../packages/contracts) | 共享接口协议 |
| [packages/scoring](../../packages/scoring) | 共享评分逻辑 |
| [scripts](../../scripts/README.md) | 开发、校验、安装与打包脚本 |
| [docs](../README.md) | 使用、安全、架构、规格、发布与历史文档 |
| [examples/demo](../../examples/demo) | 不含客户数据的合成示例 |
| [licenses](../../licenses) | 第三方许可证原文 |
| [.github](../../.github) | CI、模板、社区文件与安全入口 |

## 根目录保留什么

保留中英文 README、LICENSE、THIRD_PARTY_NOTICES、CHANGELOG，以及工具需要发现的配置：`package.json`、pnpm workspace/锁文件、TypeScript/Vitest 配置、EditorConfig、Git 配置、Node/Python 版本及 uv 配置。

贡献指南与行为准则位于 `.github/`。不创建 `.github/README.md`，以免替代根目录产品首页。不为了让 GitHub 文件列表更短而移动工具配置，也不改写提交历史来统一文件日期。

## 新文件如何归类

1. 业务代码与对应测试跟随所属应用或共享包；Python 测试留在视觉引擎内，脚本测试留在 `scripts/`。
2. 用户指南保留稳定入口；架构放 `docs/architecture/`，规格放 `docs/spec/`，版本说明放 `docs/releases/`，历史阶段报告放 `docs/archive/`。
3. 脚本沿用现有路径，以免破坏 CI、安装器复制清单和外部调用。未来移动时必须同时核对导入、工作目录、打包清单和文档。
4. 展示截图必须来自真实程序及公开示例，附生成版本、分析方式、尺寸和校验和；不得包含客户数据、凭据或本机私人路径。
5. 构建产物、依赖、虚拟环境和发行包不提交 Git。已发布安装包不因文档整理而重打包或覆盖。

## 本次整理规格

- **问题**：社区与历史文档分散、首页重复列出阶段记录，展示截图仍是旧版本。
- **方案**：社区文件归入 `.github/`，历史报告归档，增加文档与脚本导航，精简双语首页并生成真实 0.0.2 截图。
- **约束**：保留应用/共享包边界、脚本入口和当前发布物；Windows 11 真机验收保持待完成。
- **不做**：运行时代码重构、UI 改版、分支保护设置、发布包重建或历史改写。
- **成功标准**：链接与社区入口有效，截图可追溯且不含私人数据，现有构建与测试通过，发布状态表述一致。
