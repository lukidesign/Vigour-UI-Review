import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

describe('repository presentation', () => {
  it('keeps the product README at root and community files discoverable', () => {
    expect(existsSync(resolve(root, '.github/README.md'))).toBe(false);
    for (const path of ['.github/CONTRIBUTING.md', '.github/CODE_OF_CONDUCT.md', 'docs/README.md', 'scripts/README.md', 'docs/archive/README.md']) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
    for (const path of ['README.md', 'README.zh-CN.md']) {
      const text = read(path);
      expect(text).toContain('docs/assets/workbench-overview.jpg');
      expect(text).toContain('docs/assets/workbench-overview.json');
      expect(text).toContain('.github/CONTRIBUTING.md');
      expect(text).toContain('.github/CODE_OF_CONDUCT.md');
    }
  });

  it('retains the Windows 11 pending-acceptance warning in both languages', () => {
    expect(read('README.md')).toContain('Windows 11 real-machine acceptance is pending');
    expect(read('README.zh-CN.md')).toContain('Windows 11 真机验收仍待完成');
  });

  it('ties the real screenshot to the application version and public demo inputs', () => {
    const provenance = JSON.parse(read('docs/assets/workbench-overview.json'));
    const digest = (path) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
    expect(provenance.version).toBe(JSON.parse(read('package.json')).version);
    expect(provenance.applicationSourceCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(provenance.analysis).toContain('actual local vision engine');
    expect(provenance.issueCount).toBeGreaterThan(0);
    expect(provenance.sha256).toBe(digest('docs/assets/workbench-overview.jpg'));
    expect(provenance.inputs.map((input) => input.path)).toEqual(['examples/demo/design.png', 'examples/demo/implementation.png']);
    for (const input of provenance.inputs) expect(input.sha256).toBe(digest(input.path));
  });
});
