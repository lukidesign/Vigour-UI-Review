import type { Issue, Run } from '@vigour-ui-review/contracts';

type ReportIssue = Issue & { status: 'open' | 'resolved' | 'ignored' };
// Page text is untrusted: never turn it into links, HTML, or additional rows.
function text(value: unknown): string {
  return String(value ?? '未记录').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|~\-]/g, '\\$&').replace(/\r\n|\r|\n/g, '<br>');
}
function advice(issue: ReportIssue): string {
  const suggestions: Partial<Record<Issue['type'], string>> = {
    position: '核对设计中的位置与间距，按记录的偏移方向反向调整，并重新验收。',
    size: '核对设计中的宽高及盒模型；确认目标尺寸后调整，避免直接拉伸文字或图片。',
    color: '先确认是否为字体渲染或对齐差异，再核对设计色值；不要仅凭像素差异修改文字颜色。',
    text: '核对下方期望与实际文字，确认业务内容后修正。',
    missing: '确认是否因滚动、加载或遮挡而未显示；确认缺失后补充对应元素。',
    extra: '核对设计与当前业务状态，确认多余后再移除或隐藏元素。',
  };
  return suggestions[issue.type] ?? '该类型需要人工复核，请对照设计和证据确认后修改。';
}

export function markdownReport(run: Run, issues: readonly ReportIssue[], hasEvidence: boolean): string {
  const evidence = `${run.id}-annotated.png`;
  const lines = [
    '# Vigour UI Review 验收报告', '',
    `- 批次：${text(run.id)}`, `- 创建时间：${text(run.createdAt)}`,
    `- 评分：${run.score ?? '未生成'}`, `- 结果：${run.state !== 'ready' ? '未完成' : run.passed ? '通过' : '未通过'}`,
    `- 问题数：${issues.length}`, '',
    '## 证据与使用说明', '',
    hasEvidence ? `[打开差异证据 PNG](${evidence})` : '本批次尚无证据图片。',
    ...(hasEvidence ? [`请在同一批次另行导出 PNG，并与本报告保存在同一文件夹，文件名保持为 ${evidence}。`] : []),
    '坐标单位为分析图像像素，原点在左上角。以下编号为本报告顺序，使用问题 ID 和坐标定位。',
    '建议仅依据本地检测结果生成，未调用 AI；不是已验证的代码补丁，请人工确认后修改。',
    '未检出不代表所有视觉属性一致。当前分析不含专门的圆角、边框、阴影检测。分享前请检查文字和证据中是否包含敏感信息。', '',
    '| 编号 | 严重度 | 类型 | 问题 | 状态 |', '| --- | --- | --- | --- | --- |',
    ...issues.map((issue, i) => `| ${i + 1} | ${text(issue.severity)} | ${text(issue.type)} | ${text(issue.plainDescription)} | ${text(issue.status)} |`),
    '', '## 问题详情', '',
  ];
  for (const [i, issue] of issues.entries()) {
    const { x, y, width, height } = issue.rect;
    lines.push(`### ${i + 1}. ${text(issue.title)}`, '',
      `- 问题 ID：${text(issue.id)}`, `- 分组 ID：${text(issue.groupId)}`,
      `- 区域：x=${x}，y=${y}，宽=${width}，高=${height}`,
      `- 检测级别：${issue.detectorTier === 'experimental' ? '实验能力，需人工复核' : '基础检测'}；置信度：${text(issue.confidence)}`,
      `- 期望：${text(issue.expected)}`, `- 实际：${text(issue.actual)}`,
      `- 差异量：${text(issue.delta)}；单位：${text(issue.unit)}`,
      `- 修改建议：${advice(issue)}`,
      hasEvidence ? `- 证据：[差异图](${evidence})，请按上述区域定位。` : '- 证据：未生成。', '');
    if (issue.suggestedCssPatch) {
      lines.push('已有 CSS 建议（可能包含占位值，须人工补全与验证）：', '',
        ...issue.suggestedCssPatch.replace(/\r\n|\r/g, '\n').split('\n').map((line) => `    ${line}`), '');
    }
  }
  return `${lines.join('\n')}\n`;
}
