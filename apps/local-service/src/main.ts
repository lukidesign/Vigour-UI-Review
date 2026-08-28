import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildApp } from './app.js';
import { openDatabase } from './db.js';
import { loadOrCreateSessionToken } from './security.js';
import { VisionClient } from './vision-client.js';
import { resolveDatabasePath } from './product-migration.js';

const dataDir = process.env.VIGOUR_UI_REVIEW_DATA_DIR ?? process.env.DESIGN_ACCEPTANCE_DATA_DIR ?? resolve(process.cwd(), '.data');
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const db = openDatabase(resolveDatabasePath(dataDir));
const sessionToken = loadOrCreateSessionToken(resolve(dataDir, 'session-token'));
const configuredOrigins = (process.env.VIGOUR_UI_REVIEW_ALLOWED_ORIGINS ?? process.env.DESIGN_ACCEPTANCE_ALLOWED_ORIGINS ?? 'http://127.0.0.1:4173,http://127.0.0.1:4179,chrome-extension://*')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const visionCommand = process.env.VIGOUR_UI_REVIEW_VISION_COMMAND ?? process.env.DESIGN_ACCEPTANCE_VISION_COMMAND ?? resolve(import.meta.dirname, '../../vision-engine/.venv/bin/vigour-ui-review-vision');
const vision = new VisionClient(visionCommand, ['--data-root', dataDir]);
let visionAvailable = false;
try {
  await vision.request('ping', {}, 30_000);
  visionAvailable = true;
} catch {
  await vision.close();
}
const staticRoot = process.env.VIGOUR_UI_REVIEW_WORKBENCH_ROOT ?? process.env.DESIGN_ACCEPTANCE_WORKBENCH_ROOT ?? resolve(import.meta.dirname, '../../workbench/dist');
const app = buildApp(db, { sessionToken, allowedOrigins: new Set(configuredOrigins) }, resolve(dataDir, 'assets'), visionAvailable ? vision : undefined, { staticRoot });

const close = async () => {
  await app.close();
  await vision.close();
  db.close();
};
process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());

await app.listen({ host: '127.0.0.1', port: 4179 });
