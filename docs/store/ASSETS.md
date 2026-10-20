# 素材索引

核查：2026-10-20。下方商店截图的 provenance 日期为 **2026-09-16**，属于历史源码画面，**尚未更新成最终 0.0.2 提交版**。当前 README 新截图位于 [workbench-overview.jpg](../assets/workbench-overview.jpg)，尺寸 1600×1000，不能不经重新取景就视为符合商店截图规格。素材更新仍列为[提审前门槛](READINESS.md)，本次文案更新未改写图片或来源记录。

沿用 VR 品牌生成矢量与 PNG。宣传图是概念品牌插画，不是伪造的产品截图。

| 文件 | 尺寸 | 用途 |
| --- | --- | --- |
| `assets/brand.svg` | 128 viewBox | 矢量源 |
| 工程根目录 `apps/chrome-extension/public/icons/icon-128.png` | 128×128，96×96 图形加留白 | 商店/扩展图标 |
| 同目录 `icon-16.png`、`icon-32.png`、`icon-48.png` | 对应像素 | 工具栏等 |
| `assets/small-promo.png` | 440×280 | 必需小宣传图 |
| `assets/marquee.png` | 1400×560 | 可选大宣传图 |
| `assets/screenshots/01-annotated.png` | 1280×800 | 实际标注视图 |
| `assets/screenshots/02-side-by-side.png` | 1280×800 | 实际平铺视图 |
| `assets/screenshots/03-overlay.png` | 1280×800 | 实际叠加视图 |
| `assets/screenshots/qa-workbench-1920x1080.png` | 1920×1080 | QA 证据，不是商店规定尺寸截图 |
| `assets/screenshots/provenance.json` | 元数据 | 时间、示例来源、引擎和问题数 |

截图来自仓库公开示例与真实本地分析，没有客户资料、虚构问题或伪造评分。正式提交需用最终版本重新生成。真实工具栏采集截图仍需补充，不用普通扩展标签页冒充。

依据：[Chrome 图片规格](https://developer.chrome.com/docs/webstore/images)。本轮未生成或上传演示视频。

重新生成时可参考 `scripts/capture-store-screenshots.mjs` 与隔离示例流程；确认使用最终版、无真实项目/凭据、正确尺寸和可复现来源后再替换。不要直接对用户正在使用的数据或配套服务运行烟测，不用普通扩展标签页截图冒充真实工具栏弹窗。`pnpm store:check` 仅验证现有图片格式/尺寸及基础来源字段，不验证截图是否最新。
