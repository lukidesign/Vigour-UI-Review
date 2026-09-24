# Windows 11 x64 内测状态

日期：2026-09-24。适用范围：[已确认 SPEC](spec/WINDOWS-BETA-SPEC.md)。本页仅描述源码开发进度，不是安装说明或下载承诺。

## 已写入源码

- 独立 Windows x64 payload 构建与校验入口；随包复制 Node、Python、视觉依赖、工作台和扩展，封存每个文件的 SHA-256。
- 受当前用户保护的 Windows Credential Manager 帮助程序；Node 服务通过标准输入/输出调用，不把 AI/Figma 密钥放在命令行或普通配置文件。
- Windows Native Host 和 Python 启动器；二者均使用随包运行环境，不依赖用户 PATH。
- 当前用户 LocalAppData 安装、HKCU Chrome Native Messaging 注册、归属检查、安装/修复/同结构回退/保留项目数据卸载。
- Inno Setup 图形安装器源码；默认预填商店草稿扩展 ID，开发内测时可填写实际未打包扩展 ID。
- Windows CI 入口：锁定依赖、类型检查、隔离安装器测试、完整 payload、离线核心分析冒烟测试、安装器编译。

## 构建者操作（Windows x64 环境）

构建需要 Node.js 24、pnpm 11、uv 0.12、Rust 编译器与 Inno Setup 6.7。下列步骤供开发者使用，普通测试用户不应执行终端命令。

```powershell
pnpm install --frozen-lockfile
uv sync --project apps/vision-engine --extra dev --extra ocr --frozen
pnpm exec vitest run scripts/windows-installer.test.js
pnpm package:windows
pnpm package:windows:check
pnpm package:windows:smoke
pnpm package:windows:native-smoke
pnpm package:windows:installer
```

输出目录为 `release/Vigour-UI-Review-v0.0.1-windows-x64-dev/` 与 `release/windows-setup/`；两者均为未发布的开发产物。正式内测前必须递增并统一版本号，核对扩展与配套程序的组合，生成安装器 SHA-256，并由发布者检查后交给同事。构建过程可能需要联网获取锁定依赖，安装包目标是核心分析安装后离线运行。

## 当前证据与待验证事项

- [x] Mac 上的隔离 Windows 安装状态测试覆盖安装、修复、回退、未知注册、更新失败与数据保留；这些测试使用模拟注册表。
- [x] [草稿 PR #10 的 Windows CI](https://github.com/lukidesign/Vigour-UI-Review/actions/runs/35987883278) 通过：锁定依赖、类型检查、隔离安装器测试、整包校验与许可证、随包 Python 离线核心分析、Windows 凭据/Native 协议烟测，以及 Inno GUI 安装器编译。运行环境为 Windows Server 2022 构建机，不等于 Windows 11 普通用户安装验收。
- [ ] Windows 11 x64 真机，以无开发环境的普通账号安装并记录 SmartScreen/Defender 提示；不关闭安全保护。
- [ ] Chrome 工具栏真实采集、分析、导出、重复启动、休眠恢复、显示缩放与卸载升级全流程。
- [ ] OCR 模型许可证、体积及断网初始化。PyPI 提供锁定的 PaddlePaddle 3.3.1 / CPython 3.12 / Windows x64 wheel，但 wheel 存在不代表模型已经内置或运行通过。
- [ ] 用户目录 ACL、Credential Manager 读写、卸载后数据和凭据保留，在真实当前用户环境验证。
- [ ] 签名与信任提示：当前没有 Windows 代码签名证书，也没有签名结论。

以上待验证项未完成前，README 和商店内容继续标明 Windows 未受支持；不得把 CI 构建或源码提交当作已发布安装包。
