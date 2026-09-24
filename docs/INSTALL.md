# Vigour UI Review：安装与启动

> 版本边界：GitHub 已发布的 v0.0.1 仍是下方的终端启动流程。当前源码已加入 Native Messaging 开发实现，但尚未发布新版图形安装器；不要混用新扩展和旧配套程序。

## 直接使用开发者安装包

交付包支持 macOS 14+、Apple Silicon，不需要另装 Node.js、Python、PaddleOCR 或项目依赖。

1. 从 GitHub Release 下载并校验 `Vigour-UI-Review-v0.0.1-macos-arm64.zip`，然后打开解压后的同名目录。
2. 双击 `start.command`；如果 macOS 首次阻止未签名脚本，请右键选择“打开”。
3. 等待浏览器自动打开 `http://127.0.0.1:4179/`。视觉引擎首次冷启动可能需要约 30 秒，启动器最多等待 60 秒。

服务只监听本机回环地址，运行数据位于：

```text
~/Library/Application Support/Vigour UI Review/
```

首次启动检测到旧版 `~/Library/Application Support/Design Acceptance 2.0/` 时，会先拒绝不安全的符号链接，再将数据原子复制到新目录。旧目录不会被删除，可用于恢复。

## Chrome 插件（安装包）

1. 打开 `chrome://extensions` 并启用“开发者模式”。
2. 选择“加载已解压的扩展程序”。
3. 选择安装包内的 `chrome-extension/`。
4. **仅针对旧版 v0.0.1 扩展**：将应用数据目录里的 `session-token` 内容粘贴到插件。旧版保存在 `chrome.storage.local`，仅用于本机连接；新版源码改用 `chrome.storage.session` 自动配对，不再提供日常令牌输入框。

插件支持当前视口和整页采集。整页会在本地自动拼接，并出现在工作台“最近采集”列表。

## 从源码开发

要求：macOS 14+、Apple Silicon、Node.js 24+、pnpm 11+、`uv`。

```bash
pnpm install --frozen-lockfile
uv sync --project apps/vision-engine --python 3.12 --extra dev --extra ocr --frozen
pnpm release:check
pnpm start:local
```

`start:local` 会启动只监听 `127.0.0.1:4179` 的服务，并打开已配对的工作台。运行数据位于：

```text
~/Library/Application Support/Vigour UI Review/
```

### Chrome 插件（新版源码，阶段 B 开发流程）

1. 运行 `pnpm build`。
2. 打开 `chrome://extensions` 并启用“开发者模式”。
3. 选择“加载已解压的扩展程序”。
4. 选择 `apps/chrome-extension/dist`。
5. 复制扩展管理页显示的 ID。需要下方的 Native Host 开发配对；仅加载扩展还不能自动启动旧版配套程序。

插件支持当前视口和整页采集。整页会在本地自动拼接，并出现在工作台“最近采集”列表。

### Native Host 开发构建与配对

当前只验证本机 Apple Silicon 构建。开发者还需安装 Rust 编译器，或通过 `VIGOUR_RUSTC` 指定 `rustc`。Chrome 至少需要 116 版。下面的注册命令会修改当前用户 Chrome 的 Native Messaging 清单；它是开发工具，不是面向普通用户的安装器。

```bash
pnpm build
pnpm build:native
pnpm test:native
# 制作新的开发包；已存在的目标目录不会被覆盖
pnpm package:dev
# 替换包路径和扩展 ID 后再执行
node scripts/register-native.mjs --package /absolute/path/to/companion --extension-id YOUR_EXTENSION_ID
```

`test:native` 使用临时包、数据目录和注册清单，不改写真实 Chrome 配置。端口 4179 已占用时拒绝运行，不会终止其他服务。此测试不等于真实工具栏采集已验收。

注册后先停止自己此前手动启动的旧服务，再重新加载扩展，从真正的工具栏打开：

1. 扩展自动连接本地程序；首次冷启动可能需约 30 秒。
2. 点击“打开工作台”，通过短期一次性票据连接，不需要粘贴令牌。
3. 切到目标网页，再从扩展发起视口或整页采集。
4. 工作台关闭且无活动任务约 15 分钟后服务自动退出。工作台后台标签页不视为关闭；异常关闭和休眠恢复可能延后退出。

每次成功启动服务都会轮换令牌。扩展令牌仅在 `chrome.storage.session`，工作台仅在标签页 `sessionStorage`；URL 中的票据在交换前立即移除。重启服务后，请从扩展重新打开旧工作台标签页。

来源只授权一个明确扩展 ID，不允许 `chrome-extension://*`。注册脚本拒绝覆盖指向其他安装目录的清单；移动目录或更换扩展 ID 后需要重新配对。更新扩展后刷新目标页面，以清除旧常驻脚本。

阶段 C 已加入图形安装、卸载、更新/修复与同数据结构回退的开发实现，见下文。商店 ID 已取得（`dmkfgmpbomjjhalgnfhcpalobdnklchh`），但匹配安装包、正式签名和真实 Chrome 端到端验收仍未完成；[阶段 B 记录](STAGE-B-REVIEW.md) 是当时状态，不表示图形安装当前仍未开发。最新门槛见[交付状态](DELIVERY-STATUS.md)。不要将此源码状态直接作为公开版分发。

采集时请保持目标标签页不变。支持取消未提交的采集；开始提交后不能取消。如果提示“提交未确认”，先检查工作台“最近采集”，避免重复提交。采集故障后若页面未恢复，可刷新目标页。

## Figma

在 Figma 创建只包含 `file_content:read` 权限的 Personal Access Token。工作台首次导入 Frame 时会把 Token 写入 macOS 钥匙串；SQLite、浏览器存储、URL 和日志均不保存 Token。OAuth 接口已预留，但不属于当前个人版。

## 可选 AI

AI 不参与检测和评分，只解释已经产生的结构化差异。支持 OpenAI、Gemini、Kimi 和 DeepSeek。API Key 只存 macOS 钥匙串；每次外发前都必须勾选数据范围，并生成 10 分钟内有效、只能消费一次的同意回执。

## 制作开发者安装包

```bash
pnpm package:dev
pnpm package:check
pnpm package:smoke
pnpm package:archive
```

开发者目录位于 `release/Vigour-UI-Review-v0.0.1-macos-arm64/`，ZIP 和 SHA-256 文件位于 `release-artifacts/`。当前版本号尚未递增，新包不得覆盖已发布的同版本下载资产。Native 构建需要 Rust；`start.command` 仍作为手动开发入口保留。Rust 运行库许可随新包提供，Python 依赖按锁文件及哈希安装。发布前仍需正式版本整包复验。

## 图形安装助手（阶段 C，未发布开发构建）

首轮仅面向 Apple Silicon；尚无 Developer ID 签名、公证或干净机器安装结论。编译部署目标不等于已验证最低系统版本。不要通过关闭 Gatekeeper 或系统安全策略来安装。

```bash
# 先制作新的配套包；两个变量均使用明确绝对路径
VIGOUR_UI_REVIEW_PACKAGE_DIR=/absolute/path/to/new-companion pnpm package:dev
VIGOUR_UI_REVIEW_PACKAGE_DIR=/absolute/path/to/new-companion \
VIGOUR_INSTALLER_OUTPUT='/absolute/path/to/Vigour UI Review Setup.app' \
pnpm build:installer
# 仅隔离测试，不修改当前用户 Chrome 配置
VIGOUR_INSTALLER_PAYLOAD='/absolute/path/to/Vigour UI Review Setup.app/Contents/Resources/companion' \
pnpm test:installer
```

构建需要 Xcode Command Line Tools；运行助手使用随包 Node，不依赖用户终端环境。拿到真实商店 ID 后，构建时可用 `VIGOUR_STORE_EXTENSION_ID` 预填；开发内测仍需从扩展管理页复制正确 ID。

安装助手提供：

- 安装/更新并配对：校验包，写入当前用户 `Library/Application Support/Vigour UI Review Companion/versions`，最后切换 Chrome 清单。
- 修复配对：校验已安装程序，再恢复自己的注册；损坏程序需重新安装完整包。
- 回退上一安装：保留前一程序，不还原数据库。本轮只验证相同数据库结构，未来有数据迁移时必须另做兼容校验。
- 卸载：只移除自己的注册，把管理的程序移到当前用户废纸篓；项目、截图、历史与钥匙串保留。

请先关闭工作台和扩展弹窗。活动任务阻止操作；其他程序或旧版手动服务占用 4179 时停止，不自动杀进程。已有其他目录的 Native 注册不会被覆盖，旧开发配对需先确认归属后解除。

异常断电/崩溃后的 `install.lock` 暂不自动抢占。若持续提示忙，不要盲删锁或程序目录；先核实旧安装进程已退出并保留现场，由开发者协助恢复。这也是公开发布前的恢复体验待办。

开发验证与剩余门槛见 [阶段 C 记录](STAGE-C-REVIEW.md)，商店草稿见 [材料包](store/README.md)。

## 常见问题

- **macOS 阻止启动**：安装包尚未签名。按住 Control 点击 `start.command`，选择“打开”。
- **4179 端口已占用**：停止另一个 Vigour UI Review 实例或占用 `127.0.0.1:4179` 的程序后重试。
- **新版工作台连接失效**：从 Chrome 扩展重新打开，不要反复粘贴旧令牌。手动连接仅保留在开发调试折叠项。
- **新版扩展提示未安装**：检查配套程序与扩展版本、扩展 ID、Native Host 注册路径；旧 v0.0.1 包不能替代新版程序。
- **新版扩展提示手动服务运行中**：在原启动终端正常停止旧服务，再从扩展连接。
- **首次启动较慢**：PaddleOCR/OpenCV 冷启动约需 30 秒；启动器最多等待 60 秒。

## 卸载

旧版：停止服务后，删除开发者安装包即可移除程序。若运行过新版开发注册，还需要确认归属后移除该命令生成的 `com.vigour_ui_review.local.json` 清单，避免残留无效路径。阶段 C 助手只卸载自己管理的安装，不能代替旧版卸载。运行数据和钥匙串密钥应保留，防止误删。清除数据属于单独操作，请先备份，再使用系统工具处理自己的应用数据与钥匙串条目。
