import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

describe('prerelease publication boundaries', () => {
  it('does not run the stable publisher for prerelease tags', () => {
    expect(read('.github/workflows/release.yml')).toContain("if: ${{ !contains(github.ref_name, '-') }}");
    const verify = (tag) => spawnSync(process.execPath, ['scripts/verify-release-tag.mjs', tag], { cwd: root });
    expect(verify('v0.0.2-beta.1').status).not.toBe(0);
    expect(verify('v0.0.2').status).toBe(0);
  });
  it('uses one macOS minimum for both bundle metadata and executable target', () => {
    const script = read('scripts/build-installer.mjs');
    expect(read('apps/companion-installer/platform.mjs')).toContain("minimumMacOS: arch === 'arm64' ? '14.5' : '14.0'");
    expect(script).toContain('const minimumMacOS = platform.minimumMacOS');
    expect(script).toContain('<key>LSMinimumSystemVersion</key><string>${minimumMacOS}</string>');
    expect(script).toContain('`${platform.binaryArch}-apple-macos${minimumMacOS}`');
  });
  it('retains the pending Windows 11 acceptance flag in distributed metadata', () => {
    const script = read('scripts/stage-windows-candidate.mjs');
    expect(script).toContain("windows11Acceptance: 'pending'");
    expect(script).toContain("'Not tested on a Windows 11 user PC'");
    expect(script).toContain('unsigned: true, release: false');
  });
});
