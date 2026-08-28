import { describe, expect, it } from 'vitest';
import { parseFigmaUrl } from './figma.js';

describe('parseFigmaUrl', () => {
  it('extracts file and node identities from supported URLs', () => {
    expect(parseFigmaUrl('https://www.figma.com/design/AbCd1234/Product?node-id=12-34&t=ignored')).toMatchObject({ fileKey: 'AbCd1234', nodeId: '12:34' });
  });
  it('rejects lookalike hosts and URLs without a selected node', () => {
    expect(() => parseFigmaUrl('https://figma.com.evil.test/design/key/name?node-id=1-2')).toThrow('INVALID_FIGMA_URL');
    expect(() => parseFigmaUrl('https://www.figma.com/design/AbCd1234/Product')).toThrow('FIGMA_NODE_URL_REQUIRED');
  });
});
