import type { DomNodeSnapshot } from '@vigour-ui-review/contracts';
import type { FigmaSemanticNode } from './figma.js';

export interface SemanticMatch { figmaNodeId: string; domNodeId: string; confidence: number; evidence: string[] }

function text(value?: string) { return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase() ?? ''; }

export function semanticAlign(figmaNodes: readonly FigmaSemanticNode[], domNodes: readonly DomNodeSnapshot[]): SemanticMatch[] {
  const matches: SemanticMatch[] = [];
  const used = new Set<string>();
  for (const figma of figmaNodes) {
    if (!figma.rect) continue;
    let best: { dom: DomNodeSnapshot; score: number; evidence: string[] } | undefined;
    for (const dom of domNodes) {
      if (used.has(dom.nodeId)) continue;
      let score = 0; const evidence: string[] = [];
      if (text(figma.text) && text(figma.text) === text(dom.text)) { score += 0.75; evidence.push('exact-text'); }
      const sizeRatio = Math.min(figma.rect.width, dom.rect.width) / Math.max(figma.rect.width, dom.rect.width, 1)
        * Math.min(figma.rect.height, dom.rect.height) / Math.max(figma.rect.height, dom.rect.height, 1);
      if (sizeRatio > 0.75) { score += 0.2 * sizeRatio; evidence.push('similar-size'); }
      if (figma.type === 'TEXT' && dom.text) { score += 0.05; evidence.push('text-role'); }
      if (!best || score > best.score) best = { dom, score, evidence };
    }
    if (best && best.score >= 0.7) { used.add(best.dom.nodeId); matches.push({ figmaNodeId: figma.id, domNodeId: best.dom.nodeId, confidence: Math.min(1, best.score), evidence: best.evidence }); }
  }
  return matches;
}
