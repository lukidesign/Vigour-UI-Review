# 脚本索引

[项目首页](../README.zh-CN.md) · [仓库结构](../docs/architecture/REPOSITORY.md)

以下命令均从仓库根目录执行。脚本保留已有路径，按职责在此导航；不因文档整理改变 CI 或安装器入口。

## 开发与校验

| 命令 | 入口与用途 |
| --- | --- |
| `pnpm start:local` | [start-local.mjs](start-local.mjs)：启动本地工作台与服务 |
| `pnpm repository:check` | [check-repository.mjs](check-repository.mjs)：版本、链接、必需文件与泄漏检查 |
| `pnpm typecheck` / `pnpm test` / `pnpm build` | workspace 类型检查、Vitest 与生产构建 |
| `pnpm release:check` | [release-check.mjs](release-check.mjs)：仓库、商店素材、类型、测试、构建与视觉基准 |
| `pnpm benchmark` | [视觉基准入口](../apps/vision-engine/benchmark/run_benchmark.py)：合成样本，不代表真实网站准确率 |
| `pnpm docs:screenshots` | [capture-readme.ts](capture-readme.ts)：隔离数据与真实引擎生成首页截图及来源记录 |

截图命令需要先完成 `pnpm build` 和视觉引擎环境安装；设置 `VIGOUR_SMOKE_PLAYWRIGHT` 为本机 Playwright 模块绝对路径、`VIGOUR_SMOKE_CHROME` 为 Chrome 可执行文件绝对路径。不安装新的项目依赖。它通过内存请求桥接运行真实本地服务，不占用 4179、不接触现有项目库或系统凭据，也不验证真实 Chrome 扩展采集。

`pnpm exec tsx scripts/smoke-capture-recovery.ts` 使用相同环境变量，验证真实拼接与采集状态弹窗的成功、失败、处理中、刷新和深浅主题排版。截图输出到新建临时目录；不替换公开 README 图片。此脚本当前使用 macOS/Linux 虚拟环境入口，不等于 Windows 真机验收。

## macOS 与扩展打包

| 命令 | 入口 |
| --- | --- |
| `pnpm build:native` / `pnpm build:installer` | [Native Host](build-native.mjs) / [图形安装器](build-installer.mjs) |
| `pnpm package:dev` | [完整本地包](package-dev.mjs) |
| `pnpm package:check` / `pnpm package:smoke` | [完整性检查](check-package.mjs) / [离线分析检查](smoke-package.mjs) |
| `pnpm test:native` / `pnpm test:installer` | [Native 集成](smoke-native.mjs) / [安装器生命周期](smoke-installer.mjs) |
| `pnpm package:archive` / `pnpm package:extension` | [归档](archive-package.mjs) / [扩展包](package-extension.mjs) |

[register-native.mjs](register-native.mjs) 注册本机主机，[app-paths.mjs](app-paths.mjs) 统一数据路径，[smoke-native-ui.mjs](smoke-native-ui.mjs) 支撑隔离 UI 验证。Native/安装器/打包冒烟检查可能需要独占 4179；不要为测试直接终止未知的用户服务。安装与注册会影响对应测试环境，先阅读脚本及[发布指南](../docs/RELEASING.md)。

Apple Silicon beta.4 使用 [独立 CI](../.github/workflows/apple-silicon.yml)：[旧包夹具下载](fetch-arm64-upgrade-fixture.mjs) 先验证公开 beta.1 的固定 SHA-256，再供隔离升级测试使用；设置 `VIGOUR_LEGACY_INSTALLER_PAYLOAD` 后，安装器烟测检查旧项目、采集、分析、图片和导出保留。[候选归档](stage-arm64-candidate.mjs) 生成完整安装器＋扩展 ZIP、来源记录和校验和，不直接发布 Release。Intel 仍使用 [Intel 候选入口](stage-intel-candidate.mjs)。

## Windows 测试候选包

| 命令 | 入口 |
| --- | --- |
| `pnpm package:windows` | [打包](package-windows.mjs) |
| `pnpm package:windows:check` / `pnpm package:windows:smoke` | [完整性](check-windows-package.mjs) / [离线分析](smoke-windows-package.mjs) |
| `pnpm package:windows:native-smoke` | [Native 与凭据检查](smoke-windows-native.mjs) |
| `pnpm package:windows:installer` | [图形安装器](build-windows-installer.mjs) |
| `pnpm package:windows:candidate` | [整理候选包](stage-windows-candidate.mjs) |

需要 Windows 构建环境，详见 [Windows 构建状态](../docs/WINDOWS-BETA-STATUS.md)。Windows Server CI 成功不能替代 Windows 11 真机验收。

## 发布与商店材料

- `pnpm release:verify-tag` → [版本标签校验](verify-release-tag.mjs)
- `pnpm store:check` / `pnpm store:package` → [素材校验](check-store-assets.mjs) / [材料打包](package-store-materials.mjs)
- [品牌素材生成](build-store-brand.mjs)、[隔离商店截图](capture-store-screenshots.mjs)

本地打包不等于公开发布。发布流程、签名限制、校验和与平台验收要求见[发布指南](../docs/RELEASING.md)。`*.test.js` 是脚本回归测试，由根目录 Vitest 统一执行。
