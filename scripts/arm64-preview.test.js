import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const read = (path) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');

it('requires native arm64, locked OCR dependencies and real upgrade checks before candidate staging', () => {
  const workflow = read('.github/workflows/apple-silicon.yml');
  expect(workflow).toContain("process.arch!=='arm64'");
  expect(workflow).toContain('--extra dev --extra ocr --frozen');
  expect(workflow).toContain('contents: read');
  expect(workflow.indexOf('pnpm test:installer')).toBeLessThan(workflow.indexOf('node scripts/stage-arm64-candidate.mjs'));
  expect(workflow).toContain('VIGOUR_LEGACY_INSTALLER_PAYLOAD');
  expect(read('scripts/smoke-package.mjs')).toContain("process.arch === 'arm64' && capabilities.data.localOcr !== true");
});

it('locks the old public fixture and keeps preview acceptance claims conservative', () => {
  const fixture = read('scripts/fetch-arm64-upgrade-fixture.mjs');
  expect(fixture).toContain('35af45dc6327c136327f064d320facdd66a999f59aa2c6ddb874fac22200162b');
  expect(fixture.indexOf('hash.digest')).toBeLessThan(fixture.indexOf("['-x', '-k'"));
  const stage = read('scripts/stage-arm64-candidate.mjs');
  for (const term of ["v0.0.2-beta.4", "darwin-arm64", 'ocrDependenciesBundled: true', "offlineOcrAcceptance: 'pending'",
    "appleSiliconRealMachineRetest: 'pending'", "minimumOSAcceptance: 'pending'", 'unsigned: true', "['rev-parse', 'HEAD']"]) expect(stage).toContain(term);
  expect(read('docs/APPLE-SILICON-TESTER-GUIDE.md')).toContain('不保证升级后直接回退 beta.1');
  expect(read('scripts/smoke-installer.mjs')).toContain('Upgrade must retain run, issue IDs/content and evidence relationship');
});
