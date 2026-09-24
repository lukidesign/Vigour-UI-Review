# Chrome Web Store 材料包

更新：2026-09-24。**内测提交草稿，不代表已上架或审核通过。** 发布商名称与工程版权署名统一为 LukiDesign，插件名称仍为 Vigour UI Review。2026-09-16 已在后台确认发布商名称、取得固定 ID 并保存私享草稿；这不是对今日后台状态的重新核验。最新交付门槛见[交付状态](../DELIVERY-STATUS.md)。

| 材料 | 文件 |
| --- | --- |
| 中英文名称、简介、详情 | [LISTING.md](LISTING.md) |
| 单一用途、权限、数据声明 | [PRIVACY-FIELDS.md](PRIVACY-FIELDS.md) |
| 英文隐私政策 | [PRIVACY.md](../PRIVACY.md) |
| 中文隐私说明 | [PRIVACY.zh-CN.md](PRIVACY.zh-CN.md) |
| 审核员指引 | [REVIEWER-NOTES.md](REVIEWER-NOTES.md) |
| 首轮内测表 | [BETA-CHECKLIST.md](BETA-CHECKLIST.md) |
| 图标、宣传图、截图索引 | [ASSETS.md](ASSETS.md) |
| 扩展 ZIP 与创建草稿步骤 | [DRAFT-UPLOAD.md](DRAFT-UPLOAD.md) |

## 仍需真实信息和操作

1. 开发者账号、联系/身份信息和后台验证由账号持有人完成，不把凭据写入工程。
2. 已取得商店 ID `dmkfgmpbomjjhalgnfhcpalobdnklchh`；仍需用 `VIGOUR_STORE_EXTENSION_ID` 构建匹配安装器并实测。本地加载 ID 不能冒充商店 ID。
3. 选择新版本号并复验；源码仍为 0.0.1，不覆盖现有同版本 Release。
4. 发布匹配的配套安装器、说明及校验值。当前是未经 Developer ID 签名/公证的开发构建，干净机器安装仍待验证。
5. 英文隐私文件已于 2026-09-16 单独发布并验证公开可访问：`https://github.com/lukidesign/Vigour-UI-Review/blob/main/docs/PRIVACY.md`。新版本提审前须复核其与实际行为及后台勾选一致；三项合规承诺由发布者确认。
6. 支持入口拟用 [GitHub Issues](https://github.com/lukidesign/Vigour-UI-Review/issues)，可换成确认的专用邮箱。不要公开提交令牌或客户数据。
7. 完成真实 Chrome 工具栏采集、后台/休眠、升级与卸载内测，补充可信测试员名单。后台已保存私享草稿，但尚未完成可安装内测版交付；不要直接提交现有占位测试说明。

商店 ZIP 只放扩展文件，不放 Node/Python、安装器或个人 Native 配置。首轮为 Apple Silicon Mac，不宣称 Windows、Intel Mac、Linux 或 ChromeOS 完整支持。英文文案不等于英文 UI 已完成。

## 重新生成

```bash
# 配置可用 Playwright 与 Chromium；仓库不强制安装浏览器依赖
node scripts/build-store-brand.mjs
# 需设置 VIGOUR_SMOKE_PLAYWRIGHT 和 VIGOUR_SMOKE_CHROME 才启用浏览器截图
VIGOUR_STORE_CAPTURE=1 pnpm test:native
node scripts/check-store-assets.mjs
# 生成独立的材料 ZIP（不是商店扩展 ZIP），不覆盖已有输出
VIGOUR_STORE_MATERIALS_DIR=/absolute/path/to/new-materials pnpm store:package
```

生成截图只操作临时服务与示例数据。提交时以后台最新字段为准，发布者需复核，不能保证审核结果。

参考：[图片规格](https://developer.chrome.com/docs/webstore/images)、[隐私字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)、[私密分发](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)。
