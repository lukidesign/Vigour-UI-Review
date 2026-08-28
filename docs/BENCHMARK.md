# 检测基准

运行：

```bash
pnpm benchmark
```

脚本确定性生成 50 组 Web UI 基线图，每组包含 10 个已标注差异，共 500 个差异，覆盖位置、尺寸、颜色、缺失和多余。输出写入 `.benchmark-output/`，包括 100 张 PNG 与 `manifest.json`。

当前合成基线结果：

- Precision：100%
- Recall：100%
- 平均坐标误差：0 px

发布门禁为 Precision ≥ 90%、Recall ≥ 85%、平均坐标误差 ≤ 2 px。

这是确定性回归基线，不能替代真实业务样本。对外宣称真实页面准确率之前，仍需由设计/前端共同标注 50 组生产 Web 页面，并按相同格式运行盲测；动态内容、复杂渐变、Canvas/WebGL、视频和跨域 iframe 应分别统计，不得混入稳定检测器数据美化指标。
