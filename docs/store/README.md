# Chrome Web Store 材料包

更新：**2026-10-20**。发布商与版权署名：**LukiDesign**。产品：**Vigour UI Review**。

**材料已按 0.0.2 行为整理，但尚不能据此认定可通过审核。** 本次仅更新文档、核查源码，不上传扩展、不修改商店后台、不提交审核、不重发安装包。实现与证据缺口见[提审准备度](READINESS.md)。

GitHub 已有 [v0.0.2-beta.1 双平台未签名 Beta](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1)，程序和扩展显示 0.0.2；Windows 11 真机验收仍待完成。公开 Beta、源码合并、商店草稿和商店批准是不同状态。

| 面向谁 | 材料 |
| --- | --- |
| 普通测试者 | [双平台测试说明与回传模板](../BETA-TESTING.md)、[Windows 安装指南](../WINDOWS-TESTER-GUIDE.md) |
| 商店访客 | [中英文简介和详情](LISTING.md)、[英文隐私政策](../PRIVACY.md)、[中文隐私说明](PRIVACY.zh-CN.md) |
| 后台填写者 | [单一用途、逐项权限、数据分类](PRIVACY-FIELDS.md)、[更新既有草稿的步骤](DRAFT-UPLOAD.md) |
| 审核员 | [安装、复现、隐私验证与卸载指引](REVIEWER-NOTES.md) |
| 维护者 | [提审准备度和实现缺口](READINESS.md)、[验收记录表](BETA-CHECKLIST.md)、[素材索引](ASSETS.md) |

## 提交边界

1. 历史记录的草稿 ID 为 `dmkfgmpbomjjhalgnfhcpalobdnklchh`；本次没有登录后台重新验证版本、分发状态或审批结果。不要用本地加载 ID 替代商店条目 ID。
2. 先关闭准备度清单中的阻断项，再由持有人确认开发者账号验证、联系方式、两步验证、分发范围与数据用途认证。凭据只进入官方后台，不写入仓库。
3. 用户测试可加载 Release 中解压的扩展；**商店审核要测试实际提交的商店扩展**和匹配配套程序，不能靠换成另一份本地扩展“证明通过”。
4. 安装包未签名、公证/干净机验收未完成时，不承诺所有用户可直接运行，不指导关闭系统安全机制。Windows 仅为 x64 测试渠道；不宣称 macOS Intel、Windows ARM、Linux 或 ChromeOS 支持。
5. 新文档不追溯修改已发布 ZIP 内的旧说明。现有 Release 保持原字节与校验和；后续实现修复需协调版本、构建、测试、说明与新发布。

## 材料检查

```bash
pnpm repository:check
pnpm store:check
pnpm exec vitest run scripts/store-materials.test.js
```

这些命令检查链接、素材规格及文档一致性，**不执行真实商店审核，也不能关闭安全或真机门槛**。素材重新生成入口见 [ASSETS.md](ASSETS.md)，扩展打包入口见 [DRAFT-UPLOAD.md](DRAFT-UPLOAD.md)。`store:package` 是内部文档素材归档，不是可上传的扩展 ZIP；以仓库在线链接为完整导航。
