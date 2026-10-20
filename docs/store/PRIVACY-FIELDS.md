# 商店隐私后台字段草稿

更新：2026-10-20。依据当前 0.0.2 源码；最终由账号持有人对照提交包和后台字段确认，**本文件不代为勾选或认证**。未关闭事项见 [READINESS.md](READINESS.md)。

## Single purpose

Provide user-initiated webpage capture for local UI design review: collect the selected page's screenshot and layout evidence, compare it with a design image in a paired local companion, and inspect/export visual differences.

## 权限理由（可复制英文）

| 权限 | Justification |
| --- | --- |
| activeTab | Temporarily accesses the user-selected page for screenshots after an explicit capture action, without persistent access to all websites. |
| scripting | Injects bundled content.js after capture starts to read page text, geometry and computed styles, prepare scrolling/animations, and restore the page. DOM collection may include off-screen elements in either capture mode. |
| storage | Stores the current companion connection credential in chrome.storage.session, not Chrome sync. Successful connection removes the legacy sessionToken from extension local storage. The companion separately stores its local session-token file. |
| nativeMessaging | Connects to the explicitly paired local host to start/reuse the companion and establish a session when the popup is opened or reconnection is requested. It does not accept arbitrary shell commands. |
| alarms | Periodically reports matching local workbench tab IDs to the already-connected companion for idle management. The alarm does not start the companion or read unrelated tab contents. |
| http://127.0.0.1:4179/* | Exchanges authenticated capture payloads, capabilities, activity and one-time opening tickets with the companion on the same computer. It does not grant persistent access to general websites. |

Manifest 不申请 `tabs`、`history`、`cookies`、`webRequest`、`<all_urls>`。调用 `chrome.tabs` 的部分方法不等于申请 `tabs` 权限；此处使用 activeTab 和限定主机权限。实现映射见 [READINESS.md](READINESS.md)，manifest 改动后必须重新核对。

## Remote code

当前源码对应建议：**No, I am not using remote code**，但须先验证最终 ZIP。

扩展脚本随包分发，content.js 按用户操作注入；未发现扩展下载/执行远程 JS/WASM 的路径。Native 配套程序单独安装并明确披露。AI 返回内容作为数据展示，不执行生成的 CSS/代码。最终构建及依赖仍需检查动态执行、远程加载和混淆，不能只凭源码声明。

## 数据类别

**不得因为“本地处理”而选择“不收集/处理用户数据”。** 后台当前定义是最终依据，下面是保守申报建议，不是已经保存的勾选结果。

| 类别 | 当前处理及申报理由 |
| --- | --- |
| Website content / 网站内容 | 截图、页面文字、DOM/CSS、导入图片和验收证据；视口截图不代表 DOM 仅限视口。 |
| Web history / 浏览记录 | 用户主动采集页面的完整 URL 和标题；不是读取 Chrome 全量历史数据库。 |
| Authentication information / 身份验证信息 | 会话令牌和用户配置的 Figma PAT/AI Key。区分 Chrome 会话存储、本地令牌文件与 macOS Keychain / Windows Credential Manager。 |
| User activity / 用户活动 | 采集时滚动/视口信息、选定页面变化检测、工作台 tab ID 和空闲管理；不用于行为广告或键盘记录。按实际后台定义保守披露。 |
| Personally identifiable information、Personal communications、Financial/payment、Health 等 | 通用截图/文字/URL 可能包含这些信息，现有实现无法自动排除。不能仅以“请勿上传敏感内容”认定不存在；提交前按允许采集范围及后台类别确认，无法证明排除时保守声明可能处理的类别。 |
| Location / 位置 | 不调用设备定位 API；网页内容/URL 仍可能带位置，不能把“没有定位权限”解释为绝不会处理位置内容。 |

上述内容默认保存在本机，但用户可向 AI 服务发送问题上下文及明确勾选的完整证据图。Figma 导入向 Figma 发送认证及文件/节点标识。开发者不默认接收本地验收数据；支持材料由用户主动提供。存储、接收方、保留和删除详见[英文](../PRIVACY.md)/[中文](PRIVACY.zh-CN.md)政策。

## Limited Use 与政策地址

建议用途说明：

> LukiDesign commits to using and transferring user data in accordance with the Chrome Web Store User Data Policy, including its Limited Use requirements. Data supports only the disclosed user-facing review features. We do not sell data, use or transfer it for advertising, or use it for creditworthiness or lending decisions. Optional transfers require the user's requested integration and consent.

后台用途认证必须由持有人检查实际行为后确认，不因存在这段文本就自动符合要求。

- 英文政策：https://github.com/lukidesign/Vigour-UI-Review/blob/main/docs/PRIVACY.md
- 中文政策：https://github.com/lukidesign/Vigour-UI-Review/blob/main/docs/store/PRIVACY.zh-CN.md

更新合并后，以未登录状态验证可访问；把同一政策地址填入后台。政策、界面提示、后台勾选和最终包必须一致。

依据：[后台隐私字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)、[用户数据 FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)、[MV3 要求](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)。本次未操作后台。
