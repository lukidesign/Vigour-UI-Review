import { describe, expect, it } from 'vitest';
import type { DomNodeSnapshot } from '@vigour-ui-review/contracts';
import type { FigmaSemanticNode } from './figma.js';
import { semanticAlign } from './semantic-aligner.js';

describe('semanticAlign', () => {
  it('uses exact text plus geometry and never reuses one DOM node', () => {
    const figma: FigmaSemanticNode[] = [
      { id: 'f1', name: '提交', type: 'TEXT', text: '提交订单', rect: { x: 0, y: 0, width: 80, height: 24 } },
      { id: 'f2', name: '重复', type: 'TEXT', text: '提交订单', rect: { x: 0, y: 40, width: 80, height: 24 } },
    ];
    const dom: DomNodeSnapshot[] = [{ nodeId: 'd1', tag: 'button', text: ' 提交订单 ', rect: { x: 1, y: 1, width: 80, height: 24 }, styles: {} }];
    expect(semanticAlign(figma, dom)).toEqual([{ figmaNodeId: 'f1', domNodeId: 'd1', confidence: 1, evidence: ['exact-text', 'similar-size', 'text-role'] }]);
  });
});
