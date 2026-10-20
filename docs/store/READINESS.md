# Chrome Web Store 提审准备度

核查日期：**2026-10-20**。发布商：LukiDesign。核查基线：main `060c4cc6ed54fa9a140c464f609f10217a3d228d`，应用/扩展 **0.0.2**。本次为执行者的对抗式自审，不冒充独立人工审批、Google 审核或完整安全审计。

**结论：文档可作为准备材料；当前不建议直接提交审核。** 下列实现风险和最终包/真机证据尚未闭环。本次只更新材料及一致性测试，不修业务代码、不重新打包、不改后台、不提交审核。

## 本次 SPEC

- **Problem Statement：** 旧测试说明仍指向过期 Actions、旧 Mac 0.0.1 和首轮 Mac-only 草稿，与当前双平台 Beta 和真实数据流不一致。
- **Proposed Solution：** 同步双平台测试说明、商店文案、权限理由、中英文隐私政策及审核员路径；把代码行为、政策要求、项目发布门槛和未知后台状态分开记录。
- **Technical Constraints：** 以源码、公开 Release 附件及官方政策为依据；保留原下载包字节/校验和；Windows 11 真机待验收，不把 Windows Server CI 视为替代。
- **Non-goals：** 本轮不变更采集/加密/权限实现，不申请签名，不改变版本，不上传或提审，不使用真实私密页面或外发 AI/Figma 测试数据。
- **Success Criteria：** 新说明覆盖两个平台、下载、安装、测试和回传；英中隐私与源码对应；权限无遗漏；列出未解决门槛；链接和回归测试通过。

## 已核实的事实（不等于通过审核）

| 检查 | 证据 |
| --- | --- |
| Manifest V3；5 项权限和单一本机主机范围 | [manifest](../../apps/chrome-extension/public/manifest.json)：activeTab、scripting、storage、nativeMessaging、alarms；主机仅 `http://127.0.0.1:4179/*` |
| 点击才采集；防错页、互斥、取消、恢复 | [capture-controller](../../apps/chrome-extension/src/capture-controller.ts) 与 [content](../../apps/chrome-extension/src/content.ts)；源码和单元测试不能替代商店版真实 Chrome 验收 |
| 弹窗连接、受限 Native 控制、工作台活动报告 | [popup](../../apps/chrome-extension/src/popup.ts)、[native-client](../../apps/chrome-extension/src/native-client.ts)；告警定时器不负责启动服务 |
| 双平台路径和系统凭据设施 | [app-paths](../../scripts/app-paths.mjs)、[keychain](../../apps/local-service/src/keychain.ts)、[Windows credential helper](../../apps/native-host/credential-store.rs) |
| AI 确认、十分钟单次回执；完整证据图选择 | [App.vue](../../apps/workbench/src/App.vue)、[consent](../../apps/local-service/src/ai-consent.ts)、[API](../../apps/local-service/src/app.ts)、[providers](../../apps/local-service/src/ai-providers.ts) |
| 双平台 Beta 和独立扩展附件已存在 | [v0.0.2-beta.1](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1)，本次读取发布元数据确认 prerelease 与实际附件；非商店发布证明 |

## 实现风险：本轮未修改

| 编号 / 优先级 | 事实与风险 | 关闭条件 |
| --- | --- | --- |
| R1 / 提审前阻断 | `content.ts::snapshotDom` 在视口/整页模式均遍历 body 元素，未按视口裁剪；可能收集视口外文字。当前弹窗只说“当前页”，不足以清晰解释视口模式边界。 | 评估每种模式所需最小数据，选择收窄采集或证明必要性并显著说明；增加敏感/视口外样例测试。仅改隐私政策不能证明收集适度。 |
| R2 / 提审前阻断 | [image-store](../../apps/local-service/src/image-store.ts) 和 [db](../../apps/local-service/src/db.ts) 的项目图片/SQLite 未实现应用层静态加密；Windows chmod 意图不能作为 ACL 验证。凭据管理器保护不覆盖项目数据。 | 对照官方 FAQ 的静态保护要求完成安全方案/实现与验证，或取得适用于实际存储方式的明确解释；不能把本机传输例外扩大为静态存储豁免。整改需独立需求，不在本次文案范围。 |
| R3 / 提审前阻断 | [popup.html](../../apps/chrome-extension/popup.html) 已有采集提示和操作按钮，但尚无政策直达链接、明确视口外范围；安装帮助仍保留“新版尚未发布时”的过时分支。[Figma 界面](../../apps/workbench/src/App.vue)还把凭据保存位置统一显示为 macOS 钥匙串，与 Windows 实现不符。 | 修正文案和入口；核查显著告知与明确同意在界面、安装前说明及数据变更场景中的完整性，包含点击动作与披露的关系。政策链接本身不能代替同意。 |
| R4 / 需新版本复核 | 目前无自动脱敏，URL/文字/截图可含敏感数据；AI 可发送完整证据图。文档已披露，不代表最小化或安全门槛自动满足。 | 用专门合成敏感数据测试捕获/导出/日志/AI 范围；最终类别保守申报，不用“用户别采集”代替实现评估。 |

R1–R4 是工程审查结论和提审风险，不是已经收到的 Google 拒审意见。单一用途及数据最小化依据[官方政策](https://developer.chrome.com/docs/webstore/program-policies/policies)。[用户数据 FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)明确本地处理也需披露，涉及静态加密要求，并单独说明同一电脑扩展与本机程序间传输的例外；因此**不将 loopback HTTP 本身简单定为违规，也不把它当成全面安全合规证明**。

## 证据与流程门槛

- [ ] **最终提交包：** 已核验现有 Release 本地副本与 `SHA256SUMS.txt` 一致。其独立扩展 ZIP 内 manifest 位于 `chrome-extension/manifest.json`，并有 `._*` macOS 附加文件：这是用户解压加载包，**不能原样当商店提交 ZIP**。需用[扩展专用打包脚本](../../scripts/package-extension.mjs)生成根目录 manifest、无附加文件的新包，并复验权限、远程代码/动态执行和配套版本；模式扫描只是辅助，历史 audit 文案需更新为真实结果。
- [ ] **真实商店 ID：** 实际提交的扩展与安装器配对及完整流程；当前记录的 `dmkfgmpbomjjhalgnfhcpalobdnklchh` 是历史草稿 ID，本次后台状态未知。本地加载 ID 成功不能代替此项。
- [ ] **用户机器：** Windows 11 安装/Chrome/生命周期/ACL；macOS 干净机、最低系统、休眠/空闲。不得通过关闭系统安全保护来取得“安装成功”。签名/公证是本项目交付与可评审性事项，不宣称所有 Native 扩展都有相同的 Google 签名硬性条款。
- [ ] **可选功能：** 两种 AI 任务及 Figma 的真实授权测试、费用/账号说明和审核员私密测试安排；本轮未调用外部服务。可选功能仍需可审查。
- [ ] **素材：** 商店截图 provenance 为 2026-09-16 旧源码；不是当前 README 的新图。最终版需重拍 1280×800 或 640×400 真实产品图，并补真实工具栏流程证据；不把概念图当截图。
- [ ] **后台：** 开发者身份、联系、两步验证、当前版本、分发范围、隐私 URL、数据分类与用途认证由持有人核验。本次没有读取或修改这些字段。
- [ ] **发布同步：** 实现修复后协调新版本/包和全部文案，重做测试；既有 Beta 不因文档合并就“获得修复”或被覆盖。

## 官方依据与适用边界

检索日期为 2026-10-20；提交当天应再次检查变更。

- [披露要求](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)：处理范围和用途需透明，取得明确知情同意；新数据实践需再次披露。
- [隐私后台字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)：单一用途、权限理由、数据类别、远程代码和用途认证应与产品一致。
- [MV3 要求](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)：提交代码需可审查，不把远端返回当扩展执行逻辑。
- [测试说明字段](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions)：为审核人员提供可复现入口、必要测试访问及说明，不公开密钥。
- [图片规范](https://developer.chrome.com/docs/webstore/images)：使用真实、符合规格的展示素材。

不要把仅针对 Chrome Apps 的独立性条款误套为“MV3 扩展禁止 Native 配套程序”；也不能用“它只是本地程序”排除整套产品的数据安全与可审查性责任。Google 保留审核决定权，本材料不保证通过。
