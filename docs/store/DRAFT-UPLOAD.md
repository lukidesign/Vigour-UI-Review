# 更新商店草稿（本轮不提交审核）

发布商：LukiDesign。产品：Vigour UI Review。更新：2026-10-20。

历史：2026-09-16 创建草稿并取得 `dmkfgmpbomjjhalgnfhcpalobdnklchh`，首次上传版本记录为 0.0.1。本次没有查看或修改后台，**不能据此断言今天后台仍是该版本或分发状态**。

当前 GitHub 已发布 [v0.0.2-beta.1](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1)，应用/扩展数值版本 0.0.2。这不是商店发布记录；Windows 11 真机验收仍待完成。

## 下次获得提交授权后

1. 先关闭 [READINESS.md](READINESS.md) 阻断项。账号持有人检查官方后台中的身份/联系验证、两步验证和发布商归属。
2. 打开**既有条目**，核对实际 ID、已上传版本、审核状态和分发范围，不重复“上传新内容”创建另一个条目。
3. 根据当前后台版本确定合法的新扩展版本；实现有变化则协调配套版本、重构建、重测，不能只改版本号。当前 Native 客户端要求配套版本与 manifest 完全一致。
4. 上传**扩展专用 ZIP**：根目录有 `manifest.json`，不包含外层文件夹、Node/Python、安装器、项目数据、密钥或个人 Native 注册文件。不要上传整个 Windows/Mac 安装包或 `store-materials` 文档包。
5. 更新中英文文案、当前截图、政策 URL、权限理由、数据分类和审核测试说明。未登录检查所有政策/配套下载链接；最终文件 SHA-256 与说明逐一核对。
6. 用实际商店扩展 ID 安装配对并完成真实流程。审核员须测试提交的扩展，不用本地解压版替代。
7. 账号持有人确认 Limited Use 等认证、分发范围及全部未完成项；得到明确提交授权后才提交审核。审核结果以 Google 决定为准，不预先写“已通过”。

## 可在本地执行的检查

```bash
pnpm --filter @vigour-ui-review/chrome-extension typecheck
pnpm exec vitest run apps/chrome-extension/src scripts/store-materials.test.js
VIGOUR_EXTENSION_ZIP=/absolute/path/to/new-chrome-extension-draft.zip pnpm package:extension
```

打包器重新构建并检查版本、权限、入口、白名单文件、常见动态执行/私有路径模式，生成 SHA-256 和审查记录；这些是静态检查，不能替代最终包人工检查、真机验收或 Google 审核。现有打包审查记录中的历史用途/验收文字也须按新版本实测更新，不能直接当作当前验收报告。

本轮不执行上述上传/提审步骤、不覆盖任何 Release。

依据：[官方上传流程](https://developer.chrome.com/docs/webstore/publish)、[打包说明](https://developer.chrome.com/docs/webstore/prepare)、[审核员测试字段](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions)。
