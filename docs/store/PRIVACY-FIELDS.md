# 隐私后台字段草稿

按 2026-09-16 源码准备；发布者须与实际包和后台字段复核，不能由本文件自动代做认证。

## Single purpose

Provide user-initiated webpage capture for local UI design review: compare a design image with an implemented page and inspect visual differences in a local companion workbench.

## 权限理由（英文可复制）

| 权限 | Justification |
| --- | --- |
| activeTab | Provides temporary access to the page explicitly selected by the user for capture, including screenshots, without persistent access to all websites. |
| scripting | Injects the bundled capture script only after the user starts capture, to record layout/styles and temporarily prepare scrolling and animations, then restore the page. |
| storage | Keeps the local connection credential in extension session storage. It is not synchronized or stored permanently in extension local storage. Legacy local credentials are removed on successful reconnection. |
| nativeMessaging | Starts or reuses the installed, explicitly paired companion and establishes its local session. The protocol does not accept arbitrary shell commands. |
| alarms | Reports whether local workbench tabs are still open to prevent idle shutdown during use. Alarms do not start the companion or inspect arbitrary webpages. |
| http://127.0.0.1:4179/* | Sends user-initiated capture data to the authenticated same-device service and obtains one-time workbench opening tickets. It does not grant general website access. |

当前不申请 `tabs`、`history`、`cookies`、`webRequest` 或全站权限。实际 manifest 改动后必须同步此表。

## Remote code

拟选 No。扩展 JS 随 ZIP 打包，不下载并执行远程 JS/WASM，不把 API 响应当代码执行。Native 程序单独安装，其安装方式须向审核员解释。最终 ZIP 仍要检查远程脚本、eval 和动态执行路径。

## 数据分类复核

“本地处理”不能填成“不处理任何用户数据”。

| 实际处理 | 后台类别建议 |
| --- | --- |
| 截图、文字、DOM/CSS、设计图、问题 | 网站内容 |
| 所选页面的完整 URL 与标题 | 网络/浏览记录类字段，仅限用户选择页面；可能含查询参数 |
| 本地会话凭据，可选 Figma PAT 和 AI Key | 身份验证信息，说明临时存储/系统钥匙串的区别 |
| 视口、DPR、滚动位置、本地工作台 tab ID | 用于拼接/空闲退出，不作行为分析；若后台用户活动定义涵盖这些信息，保守披露其范围 |
| 图片中可能含姓名、财务、健康或可见密码 | 不主动分类提取，也不自动脱敏；结合内测业务范围复核对应类别，不承诺这类数据永不出现 |

不主动读取定位、Chrome 历史数据库、Cookie 或密码库，不等于截图绝无敏感内容。

## Limited Use

Vigour UI Review uses user data only for its described user-facing design-review features. It does not sell user data, use it for advertising, or use it for creditworthiness or lending decisions. The developer does not receive local review data by default. Optional transfers are initiated by the user and limited to the selected integration or AI request.

各项声明由发布者按最终行为确认。政策拟用 `https://github.com/lukidesign/Vigour-UI-Review/blob/main/docs/PRIVACY.md`，需要先更新远程内容并验证公开访问。

依据：[Chrome 隐私字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)、[用户数据 FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)。
