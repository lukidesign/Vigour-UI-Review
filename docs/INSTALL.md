# Vigour UI Review：安装与启动

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
4. 将应用数据目录里的 `session-token` 内容粘贴到插件。Token 只保存在 `chrome.storage.local`，不发送到网络。

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

### Chrome 插件（源码）

1. 运行 `pnpm build`。
2. 打开 `chrome://extensions` 并启用“开发者模式”。
3. 选择“加载已解压的扩展程序”。
4. 选择 `apps/chrome-extension/dist`。
5. 将应用数据目录里的 `session-token` 内容粘贴到插件。Token 只保存在 `chrome.storage.local`，不发送到网络。

插件支持当前视口和整页采集。整页会在本地自动拼接，并出现在工作台“最近采集”列表。

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

开发者目录位于 `release/Vigour-UI-Review-v0.0.1-macos-arm64/`，可上传 GitHub Releases 的 ZIP 和 SHA-256 文件位于 `release-artifacts/`。发布检查会验证相对软链接、构建机路径泄漏、包版本、真实图像分析与测试后包内容不变。双击包内 `start.command` 启动。

## 常见问题

- **macOS 阻止启动**：安装包尚未签名。按住 Control 点击 `start.command`，选择“打开”。
- **4179 端口已占用**：停止另一个 Vigour UI Review 实例或占用 `127.0.0.1:4179` 的程序后重试。
- **工作台要求令牌**：复制应用数据目录中 `session-token` 的完整内容，令牌文件权限应为 `0600`。
- **Chrome 插件无法连接**：确认本地服务正在运行、插件令牌正确，并在 `chrome://extensions` 中重新加载扩展。
- **首次启动较慢**：PaddleOCR/OpenCV 冷启动约需 30 秒；启动器最多等待 60 秒。

## 卸载

停止服务后，删除开发者安装包即可移除程序。运行数据和钥匙串密钥会保留，防止误删；如需彻底清除，请手动删除新旧应用数据目录，并在“钥匙串访问”中删除服务名 `com.vigour-ui-review.local` 和旧版 `com.design-acceptance.local` 的条目。
