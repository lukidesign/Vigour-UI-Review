import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

describe('store documentation consistency (not store approval)', () => {
  it('documents every manifest permission without declaring a broader grant', () => {
    const manifest = JSON.parse(read('apps/chrome-extension/public/manifest.json'));
    const table = read('docs/store/PRIVACY-FIELDS.md');
    const documented = [...table.matchAll(/^\| ([^|]+) \| /gm)]
      .map((match) => match[1].trim())
      .filter((value) => manifest.permissions.includes(value) || value.startsWith('http'));
    expect(documented.sort()).toEqual([...manifest.permissions, ...manifest.host_permissions].sort());
    expect(table).toContain('chrome.storage.session');
  });

  it('keeps both privacy notices explicit about platforms, credentials and local token files', () => {
    for (const path of ['docs/PRIVACY.md', 'docs/store/PRIVACY.zh-CN.md']) {
      const text = read(path);
      for (const term of ['2026-10-20', '0.0.2', 'v0.0.2-beta.1', '%LOCALAPPDATA%', 'chrome.storage.session', 'session-token',
        'com.vigour-ui-review.local', 'Limited Use', 'api.openai.com', 'api.moonshot.cn', 'api.deepseek.com', 'generativelanguage.googleapis.com']) {
        expect(text, `${path}: ${term}`).toContain(term);
      }
    }
    expect(read('docs/PRIVACY.md')).toContain('no automatic sensitive-data redaction');
    expect(read('docs/PRIVACY.md')).toContain('application-layer encryption at rest');
    expect(read('docs/store/PRIVACY.zh-CN.md')).toContain('没有应用层静态加密');
    expect(read('docs/store/PRIVACY.zh-CN.md')).toContain('视口外');
  });

  it('directs beta testers to versioned Release assets, not expiring Actions downloads', () => {
    const guide = read('docs/BETA-TESTING.md');
    for (const name of [
      'Vigour-UI-Review-v0.0.2-beta.1-windows-x64-unsigned.zip',
      'Vigour-UI-Review-Setup-v0.0.2-beta.1-macos-arm64-unsigned.zip',
      'Vigour-UI-Review-extension-v0.0.2.zip',
    ]) expect(guide).toContain(`/releases/download/v0.0.2-beta.1/${name}`);
    expect(guide).toContain('Windows 11 真机验收仍待完成');
    expect(guide).toContain('不是商店安装流程');
  });

  it('keeps store readiness separate from a documentation pass', () => {
    const readiness = read('docs/store/READINESS.md');
    for (const id of ['R1', 'R2', 'R3', 'R4']) expect(readiness).toContain(`| ${id} /`);
    expect(readiness).toContain('当前不建议直接提交审核');
    expect(read('docs/store/REVIEWER-NOTES.md')).toContain('extension actually submitted for review');
    expect(read('docs/store/DRAFT-UPLOAD.md')).toContain('既有条目');
    expect(read('docs/store/DRAFT-UPLOAD.md')).toContain('不要直接上传 Release');
    expect(readiness).toContain('chrome-extension/manifest.json');
    expect(read('docs/store/ASSETS.md')).toContain('2026-09-16');
  });
});
