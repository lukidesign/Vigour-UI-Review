# Vigour UI Review · Windows 11 x64 开发内测

这是 LukiDesign 的 **0.0.2 未签名候选包**，只用于受邀同事验收；不是 Chrome 商店版本或公开 Release。只支持 Windows 11 x64（Intel/AMD）。请勿把它转发给其他人，也不要用旧版 v0.0.1 配套程序混装。

## 安装（普通用户不用终端）

1. 从发布者指定的渠道取得候选 ZIP 并完整解压。确认目录内同时有 `chrome-extension`、`Vigour-UI-Review-0.0.2-windows-x64-dev-setup.exe` 和本文档。
2. Chrome 打开 `chrome://extensions`，开启“开发者模式”，点击“加载已解压的扩展程序”，选择解压后的 `chrome-extension` 文件夹。复制 Chrome 显示的 **32 位扩展 ID**。不要直接选择外层 ZIP 或安装器。
3. 双击安装器，选择“安装或更新”，将刚复制的扩展 ID 填入配对页面。安装只作用于当前用户，不应要求管理员权限、Node、Python 或命令行。
4. 在 Chrome 工具栏点击 Vigour UI Review，再选择“打开工作台”。如提示扩展未配对，先检查安装器里填的 ID 是否与 `chrome://extensions` 中一致。

此安装器尚未签名，Windows 可能显示“未知发布者”或 SmartScreen 提示。**不要关闭 Defender、SmartScreen 或调整组织安全策略。**请记录提示原文和截图；如果系统或组织策略阻止安装，停止并反馈给发布者，不要强行绕过。

`SHA256SUMS.txt` 提供给发布者或希望自行核验文件的高级用户；普通测试者无需运行 `shasum`、PowerShell 或其他校验命令。

## 验收时记录

- Windows 11 版本、CPU、Chrome 版本、显示缩放比例（100% / 125% / 150%）及 `CANDIDATE.json` 中的源码提交号。
- 能否从工具栏打开工作台、采集视口与整页、导入设计图、完成分析，并导出 PNG / Markdown / JSON。不要把包含客户或个人信息的页面用于测试，除非已获许可。
- 连续采集 20 次，记录失败次数；另试取消、切换标签、刷新/导航、关闭弹窗、重启 Chrome、等待空闲退出再打开、睡眠恢复。
- 完成测试后通过 Windows“已安装的应用”卸载，检查项目数据是否仍在；如需验证升级/回退，等待发布者提供第二个独立版本，不要拿旧 macOS 包替代。
- 可断网测试核心图片分析。OCR 模型离线可用性尚未确认，不能把 OCR 成功当作本候选包的既有保证。

遇到错误时请反馈操作步骤、提示文字和可公开的截图。**不要发送令牌、AI/Figma 密钥、客户页面原图或整个用户数据目录。**
