# Vigour UI Review 0.0.2 双平台测试说明

更新：**2026-10-20**。发布商：LukiDesign。

请协助测试 **v0.0.2-beta.1 未签名公开预发布版**；程序与 Chrome 扩展显示 **0.0.2**。本轮重点：普通用户能否完成安装、从扩展启动工作台、采集、分析和导出。

**Windows 11 真机验收仍待完成。** macOS 已有维护者本机流程记录，但不代表所有机器通过。两平台都不是已签名稳定版，Mac 未公证；本说明也不代表 Chrome Web Store 已批准或上架。

## 一、下载正确的测试包

从 [GitHub v0.0.2-beta.1 发布页](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1) 的 **Assets** 下载，不再使用旧文档中的临时 Actions 附件或过期日期。

| 平台 | 下载与文件名 |
| --- | --- |
| Windows 11，Intel/AMD 64 位 | [完整 Windows ZIP，约 171 MB](https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.1/Vigour-UI-Review-v0.0.2-beta.1-windows-x64-unsigned.zip)：`Vigour-UI-Review-v0.0.2-beta.1-windows-x64-unsigned.zip` |
| macOS 14+，Apple Silicon | [Mac 图形安装器 ZIP，约 317 MB](https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.1/Vigour-UI-Review-Setup-v0.0.2-beta.1-macos-arm64-unsigned.zip)：`Vigour-UI-Review-Setup-v0.0.2-beta.1-macos-arm64-unsigned.zip` |
| 配套 Chrome 扩展 | [0.0.2 扩展 ZIP](https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.1/Vigour-UI-Review-extension-v0.0.2.zip)：`Vigour-UI-Review-extension-v0.0.2.zip`；Windows 完整包内已有 `chrome-extension` |

发布页同时提供 `SHA256SUMS.txt` 和 `BUILD-PROVENANCE.json`。前者用于核验下载，后者记录各平台真实构建来源；不能把最新 README 提交号当作包的源码号。需要帮助校验时联系发布者，不要求普通测试者使用终端。

Release 附件不受旧 Actions 七天留存限制，但仍以发布页实际附件为准。不要下载“Source code”代替安装包；不要将 0.0.2 扩展与旧 0.0.1 程序混装。当前不提供 Intel Mac、Windows ARM、Linux 或 ChromeOS 测试包。

## 二、Windows 安装与启动

1. 完整解压 Windows ZIP，保留该目录。
2. Chrome 地址栏输入 `chrome://extensions`，开启“开发者模式”。
3. 点击“加载已解压的扩展程序”（部分界面称“加载未打包的扩展程序”），选择包内 `chrome-extension` 文件夹。复制 Chrome 显示的 **32 位扩展 ID**。
4. 双击 `Vigour-UI-Review-0.0.2-windows-x64-dev-setup.exe`，选择“安装或更新”，填入刚复制的实际扩展 ID。
5. 旧扩展若仍在，先停用以免点错；确认新扩展版本为 0.0.2，且启用。
6. 在工具栏打开 Vigour UI Review，点击“打开工作台”。

预期：当前用户安装，无需管理员权限、Node/Python、终端或手动复制 token。安装器可能因未签名显示未知发布者或安全提示；**若被 Windows 或组织策略拦截，请停止并反馈，不要关闭 Defender、SmartScreen 或其他安全保护。**

## 三、Mac 安装与启动

1. 确认是 Apple Silicon 芯片、macOS 14 或更高版本；Intel Mac 不适用。
2. 下载并解压 Mac Setup ZIP 和配套 0.0.2 扩展 ZIP，保留扩展目录。
3. 在 Chrome 扩展管理页开启开发者模式，加载解压后**直接包含 `manifest.json`**的扩展目录，复制实际 32 位 ID。
4. 打开解压后的 Setup 应用，选择安装或更新，填写该 ID。
5. 确认新扩展 0.0.2 启用、旧版停用，从工具栏点击“打开工作台”。

本轮测试图形安装与 Native 自动连接，不使用旧 0.0.1 的 `start.command` 或手动令牌流程。若 Gatekeeper、未知开发者或组织策略阻止启动，请记录并反馈；**不要关闭 Gatekeeper、删除隔离标记或降低安全设置来绕过测试。**

## 四、采集前的隐私提示

请先阅读[隐私说明](store/PRIVACY.zh-CN.md)：

- 打开扩展弹窗会连接/启动本地程序；点击采集才读取网页。
- 会处理截图、完整 URL、标题、文字、DOM/CSS、视口/滚动等元数据，默认保存在本机。视口模式也可能收集视口外的 DOM/文字。
- 不自动脱敏；项目文件没有应用层静态加密。优先使用[公开合成示例](https://github.com/lukidesign/Vigour-UI-Review/tree/main/examples/demo)或专门测试页面，不采集客户/个人敏感资料。仅隐藏画面内容不保证 DOM 或 URL 无敏感数据。
- 基础流程不要求配置 AI/Figma。可选 AI 每次发送前确认，图片默认关闭，勾选时是**完整标注证据图**；第三方处理和费用按其条款。不要在本轮擅自使用他人密钥。

## 五、按顺序测试

| 项目 | 操作与预期 |
| --- | --- |
| 首次启动 | 从真实 Chrome 工具栏打开工作台，无连接错误，无手动 token。记录首次等待时长。 |
| 网页采集 | 在获授权 HTTP/HTTPS 测试页分别采集视口与整页；页面正确、图片完整、无明显拼接错位。不要在 `chrome://` 管理页测试网页采集。 |
| 图片分析 | 展开项目栏创建项目，导入设计图，从“最近采集”选择对应实现图，点击走查；记录明显误报/漏报。 |
| 查看结果 | 切换开发图标注、平铺、透明度叠加；检查编号、定位、标注开关与问题列表对应。 |
| 导出 | 导出 PNG、Markdown、JSON，分别打开并检查内容。 |
| 连续使用 | 连续采集 20 次，记录成功、失败及错误；不要只记最终一次。 |
| 异常操作 | 分别测试取消、切换标签、刷新/导航、关闭弹窗；检查是否安全结束并恢复页面，不能错采其他页面。提交本地服务阶段取消按钮会停用。 |
| 重启与恢复 | 重启 Chrome、电脑睡眠恢复后重新打开；关闭全部工作台标签、无任务时等待约 15 分钟再试，记录是否空闲退出及启动时长，实际宽限时间可能更长。 |
| 显示适配 | 优先 1920×1080，另测 1440 宽度；记录 Windows 100%/125%/150% 缩放，检查遮挡、截断和滚动。 |
| 离线分析 | 断网后用已有本地图片测试核心分析；OCR 离线能力独立记录，仍是观察项，不能当成已保证通过。 |
| 卸载/重装 | Windows 从“已安装的应用”卸载；Mac 用 Setup 卸载。预期项目、截图和系统凭据保留。重装后验证；扩展需要单独移除。 |

升级/回退需发布者提供第二个匹配候选包，不拿旧版异构包混测。需要彻底删除数据时按隐私说明单独处理，不把“卸载保留数据”误当删除失败。

## 六、回传模板

```text
测试人（可用匿名编号）/ 日期：
渠道：v0.0.2-beta.1
程序版本 / 扩展版本：0.0.2 / ______
扩展来源：本地解压 / 商店（填写真实来源）
测试包完整文件名：
源码来源：Windows 从 CANDIDATE.json；Mac 从 Release BUILD-PROVENANCE.json
系统完整版本：
CPU / 架构 / 内存：
Chrome 版本：
屏幕分辨率 / 系统缩放：
首次安装？是否装过旧版？

安装：通过 / 失败 / 未测
扩展启动：通过 / 失败 / 未测，等待 __ 秒
视口采集：通过 / 失败 / 未测
整页采集：通过 / 失败 / 未测
分析与三模式：通过 / 失败 / 未测
PNG / Markdown / JSON 导出：____ / ____ / ____
连续采集：成功 __ 次，失败 __ 次，共 __ / 20 次
取消 / 切页 / 导航 / 关闭弹窗：
Chrome 重启 / 空闲再启动 / 睡眠恢复：
显示适配：
核心离线分析：
OCR 离线（独立观察项）：
卸载 / 重装 / 项目和凭据保留：
可选 AI/Figma：未测 / 仅界面检查 / 实际请求（说明范围，勿附密钥）

每个问题单独填写：
1. 操作步骤：
2. 预期：
3. 实际及报错原文：
4. 重复次数 / 尝试次数：
5. 截图或录屏文件名：
```

请提供一段从扩展启动到完成分析的短录屏、一组**可公开测试数据**的导出及失败截图。发送前检查所有内容；不发送 token、AI/Figma 密钥、客户原图、私密 URL 或整个用户数据目录。普通问题可发 [GitHub Issues](https://github.com/lukidesign/Vigour-UI-Review/issues)，敏感安全问题先请求私密渠道。

## 七、与商店审核的关系

这份说明服务于 **GitHub Beta 测试**，开发者模式不是商店安装流程。商店提审还要按[审核员指引](store/REVIEWER-NOTES.md)测试实际提交的扩展，并关闭[准备度清单](store/READINESS.md)。公开测试包已发布，不等于 Windows 11 已通过、全部隐私门槛已解决或 Google 已批准。
