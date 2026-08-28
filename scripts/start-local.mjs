import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_NAME, ensureApplicationDataRoot } from './app-paths.mjs';

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const releaseMode = !scriptRoot.endsWith('/scripts');
const appRoot = releaseMode ? scriptRoot : resolve(scriptRoot, '..');
const configuredDataRoot = process.env.VIGOUR_UI_REVIEW_DATA_DIR ?? process.env.DESIGN_ACCEPTANCE_DATA_DIR;
const migration = configuredDataRoot
  ? { path: resolve(configuredDataRoot), migrated: false, legacyPath: undefined }
  : await ensureApplicationDataRoot();
const dataRoot = migration.path;
await mkdir(dataRoot, { recursive: true, mode: 0o700 });
if (migration.migrated) console.log(`已将旧版数据安全复制到 ${dataRoot}；旧目录仍保留用于恢复。`);

const serviceEntry = releaseMode ? resolve(appRoot, 'service/main.js') : resolve(appRoot, 'apps/local-service/dist/main.js');
const visionCommand = releaseMode ? resolve(appRoot, 'vision-engine/run') : resolve(appRoot, 'apps/vision-engine/.venv/bin/vigour-ui-review-vision');
const workbenchRoot = releaseMode ? resolve(appRoot, 'workbench') : resolve(appRoot, 'apps/workbench/dist');
const child = spawn(process.execPath, [serviceEntry], {
  cwd: appRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: '1',
    VIGOUR_UI_REVIEW_DATA_DIR: dataRoot,
    VIGOUR_UI_REVIEW_VISION_COMMAND: visionCommand,
    VIGOUR_UI_REVIEW_WORKBENCH_ROOT: workbenchRoot,
  },
});

let ready = false;
for (let attempt = 0; attempt < 240; attempt += 1) {
  try { const response = await fetch('http://127.0.0.1:4179/health'); if (response.ok) { ready = true; break; } }
  catch { await new Promise((resolveDelay) => setTimeout(resolveDelay, 250)); }
}
if (!ready) { child.kill('SIGTERM'); throw new Error(`${APP_NAME} 本地服务在 60 秒内未能启动，请查看上方日志。`); }
const token = (await readFile(resolve(dataRoot, 'session-token'), 'utf8')).trim();
const url = `http://127.0.0.1:4179/#token=${encodeURIComponent(token)}`;
spawn('/usr/bin/open', [url], { detached: true, stdio: 'ignore' }).unref();
console.log(`${APP_NAME} 已启动：http://127.0.0.1:4179/`);
console.log('按 Ctrl+C 停止本地服务。');
process.on('SIGINT', () => child.kill('SIGTERM'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
await new Promise((resolveExit) => child.once('exit', resolveExit));
