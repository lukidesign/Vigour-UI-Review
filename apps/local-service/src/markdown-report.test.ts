import { describe, expect, it } from 'vitest';
import type { Issue, Run } from '@vigour-ui-review/contracts';
import { markdownReport } from './markdown-report.js';

const run: Run = { id: 'run_test', projectId: 'project_test', state: 'ready', score: 91, passed: false,
  createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T00:00:00Z' };
const issue: Issue & { status: 'open' } = { id: 'issue_test', runId: run.id, groupId: 'group_test', type: 'color',
  severity: 'major', confidence: 'medium', detectorTier: 'stable', title: '颜色', plainDescription: '颜色有差异',
  rect: { x: 10, y: 20, width: 30, height: 40 }, status: 'open', createdAt: run.createdAt };
describe('offline Markdown report', () => {
  it('includes stable IDs, coordinates, a portable evidence reference and qualified advice', () => {
    const output = markdownReport(run, [issue], true);
    expect(output).toContain('(run_test-annotated.png)');
    expect(output).toContain('x=10，y=20，宽=30，高=40');
    expect(output).toContain('issue\\_test');
    expect(output).toContain('修改建议');
    expect(output).toContain('先确认是否为字体渲染或对齐差异');
    expect(output).toContain('未调用 AI');
    expect(output).not.toContain('http://127.0.0.1');
  });
  it('escapes page text and isolates existing CSS suggestions from Markdown', () => {
    const output = markdownReport(run, [{ ...issue, title: '<script>alert(1)</script>',
      plainDescription: '![x](https://evil.test) | extra\n# heading', suggestedCssPatch: '```\n<img src=x>\n```' }], true);
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('![x](');
    expect(output).toContain('\\| extra<br>\\# heading');
    expect(output).toContain('    <img src=x>');
    expect(output).toContain('须人工补全与验证');
  });
  it('does not invent evidence or a pass result for an incomplete run', () => {
    const output = markdownReport({ ...run, state: 'failed' }, [], false);
    expect(output).toContain('结果：未完成');
    expect(output).toContain('尚无证据图片');
    expect(output).not.toContain('](run_test-annotated.png)');
  });
});
