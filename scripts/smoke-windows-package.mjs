import { spawn } from 'node:child_process';
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 only');
const project = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const packageRoot = process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR
  ? resolve(process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR)
  : resolve(root, 'release', `Vigour-UI-Review-v${project.version}-windows-x64-dev`);
const data = await mkdtemp(join(tmpdir(), 'vigour-windows-smoke-'));
let child;
try {
  await cp(resolve(root, 'examples/demo/design.png'), join(data, 'design.png'));
  await cp(resolve(root, 'examples/demo/implementation.png'), join(data, 'implementation.png'));
  child = spawn(resolve(packageRoot, 'vision-engine/run.exe'), ['--data-root', data], {
    cwd: packageRoot, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONPATH: '', PYTHONHOME: '' },
  });
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const request = async (id, method, params) => {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    let timeout;
    const next = await Promise.race([lines.next(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Windows vision RPC timed out')), 30_000); })])
      .finally(() => clearTimeout(timeout));
    if (next.done) throw new Error('Windows vision RPC exited');
    const response = JSON.parse(next.value);
    assert.equal(response.id, id);
    if (response.error) throw new Error(response.error.message);
    return response.result;
  };
  assert.equal((await request(1, 'ping', {})).status, 'ok');
  const result = await request(2, 'analyze', { reference_path: join(data, 'design.png'),
    candidate_path: join(data, 'implementation.png'), evidence_path: join(data, 'evidence.png'), use_ocr: false });
  assert(result && typeof result === 'object', 'Core offline analysis must return a result');
  console.log('Windows packaged Python starts without PATH dependencies and completes offline core analysis.');
} finally {
  if (child && child.exitCode === null) await new Promise((done) => { child.once('exit', done); child.kill(); });
  await rm(data, { recursive: true, force: true });
}
