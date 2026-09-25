# 创建商店草稿（不是提交审核）

发布商：LukiDesign。产品名：Vigour UI Review。日期：2026-09-16。

进度补记（2026-09-24）：首次上传和取得 ID 已完成，条目 ID 为 `dmkfgmpbomjjhalgnfhcpalobdnklchh`。以下创建步骤保留作为历史流程；后续应更新同一条目的文件包，不重复创建。取得 ID 不代表已提审、审核通过或发布。参见[交付状态](../DELIVERY-STATUS.md)。

## 当前包的用途与限制

首次创建商店草稿使用的是 0.0.1 扩展包，仅用于取得该条目的固定扩展 ID。现在的未发布源码已递增至 0.0.2，用于配套候选包验收；尚未上传商店。它不是 GitHub 旧版安装包，也没有覆盖已发布的 GitHub Release。扩展依赖配对的 Native 配套程序，不能独立完成本地分析。

真实工具栏采集、新机器安装、后台/休眠和签名等验收未完成，**不要点击提交审核或公开发布**。下一次上传商店包须确认版本高于商店现有 0.0.1，并同步扩展和配套程序重新测试。

## 操作

1. 在发布商 LukiDesign 下点击“上传新内容”。
2. 选择名称包含 `chrome-extension` 和 `draft` 的扩展 ZIP；不要上传 `store-materials` 文档素材包或约 1 GB 的本地程序。
3. 上传后保留草稿，获取条目自己的 32 位 a–p 字母扩展 ID。发布商 UUID、旧本地扩展 ID 都不能替代它。
4. 将扩展 ID 用于配套程序构建/配对，完成真实内测后才准备提交审核。

## 构建与检查

```bash
pnpm --filter @vigour-ui-review/chrome-extension typecheck
pnpm exec vitest run apps/chrome-extension/src
VIGOUR_EXTENSION_ZIP=/absolute/path/to/new-chrome-extension-draft.zip pnpm package:extension
```

打包器会重新构建、验证 Manifest V3/版本/权限/图标/入口、按白名单收集文件、检查常见动态代码及隐私路径模式，并验证 ZIP 根目录存在 manifest.json。附 SHA-256 和审查记录；静态模式检查不能代替完整安全审计或商店审核。

依据：[官方上传流程](https://developer.chrome.com/docs/webstore/publish)、[官方打包要求](https://developer.chrome.com/docs/webstore/prepare)。
