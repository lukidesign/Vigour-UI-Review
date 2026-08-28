import { randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { CaptureUpload } from '@vigour-ui-review/contracts';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 100_000_000;

function decodePng(dataUrl: string): { buffer: Buffer; width: number; height: number } {
  const comma = dataUrl.indexOf(',');
  const buffer = Buffer.from(dataUrl.slice(comma + 1), 'base64');
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('INVALID_PNG');
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1 || height < 1 || width * height > MAX_PIXELS) throw new Error('IMAGE_LIMIT_EXCEEDED');
  return { buffer, width, height };
}

export class CaptureStore {
  constructor(private readonly db: DatabaseSync, private readonly assetRoot: string) {
    mkdirSync(assetRoot, { recursive: true, mode: 0o700 });
  }

  create(input: CaptureUpload): { id: string; segmentCount: number; createdAt: string } {
    const id = `capture_${randomUUID().replaceAll('-', '')}`;
    const finalDirectory = join(this.assetRoot, id);
    const temporaryDirectory = `${finalDirectory}.tmp`;
    mkdirSync(temporaryDirectory, { recursive: false, mode: 0o700 });
    try {
      let totalBytes = 0;
      const manifest = input.segments.map((segment, index) => {
        const image = decodePng(segment.dataUrl);
        const expectedWidth = Math.round(input.viewport.width * input.viewport.deviceScaleFactor);
        const expectedHeight = Math.round(input.viewport.height * input.viewport.deviceScaleFactor);
        if (Math.abs(image.width - expectedWidth) > 2 || Math.abs(image.height - expectedHeight) > 2) {
          throw new Error('CAPTURE_DIMENSION_MISMATCH');
        }
        totalBytes += image.buffer.length;
        if (totalBytes > MAX_TOTAL_BYTES) throw new Error('CAPTURE_TOO_LARGE');
        const filename = `segment-${String(index).padStart(3, '0')}.png`;
        writeFileSync(join(temporaryDirectory, filename), image.buffer, { mode: 0o600, flag: 'wx' });
        return { filename, y: segment.y, bytes: image.buffer.length, width: image.width, height: image.height };
      });
      writeFileSync(join(temporaryDirectory, 'dom.json'), JSON.stringify(input.dom), { mode: 0o600, flag: 'wx' });
      writeFileSync(join(temporaryDirectory, 'segments.json'), JSON.stringify(manifest), { mode: 0o600, flag: 'wx' });
      renameSync(temporaryDirectory, finalDirectory);

      this.db.prepare(`INSERT INTO captures
        (id, page_url, title, mode, viewport_json, page_json, dom_path, segment_manifest_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, input.pageUrl, input.title, input.mode, JSON.stringify(input.viewport), JSON.stringify(input.page),
          join(finalDirectory, 'dom.json'), join(finalDirectory, 'segments.json'), input.capturedAt);
      return { id, segmentCount: manifest.length, createdAt: input.capturedAt };
    } catch (error) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
      rmSync(finalDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  attachImage(id: string, imageAssetId: string) {
    const result = this.db.prepare('UPDATE captures SET image_asset_id = ? WHERE id = ? AND image_asset_id IS NULL').run(imageAssetId, id);
    if (result.changes !== 1) throw new Error('CAPTURE_ATTACH_FAILED');
  }

  get(id: string) {
    const row = this.db.prepare('SELECT * FROM captures WHERE id = ?').get(id) as unknown as Record<string, unknown> | undefined;
    if (!row) throw new Error('CAPTURE_NOT_FOUND');
    return {
      id: String(row.id), title: String(row.title), pageUrl: String(row.page_url), mode: row.mode as 'viewport' | 'full-page',
      viewport: JSON.parse(String(row.viewport_json)) as { width: number; height: number; deviceScaleFactor: number },
      page: JSON.parse(String(row.page_json)) as { width: number; height: number },
      manifestPath: String(row.segment_manifest_path), imageAssetId: row.image_asset_id ? String(row.image_asset_id) : undefined,
      createdAt: String(row.created_at),
    };
  }

  list() {
    return (this.db.prepare('SELECT id FROM captures ORDER BY created_at DESC LIMIT 100').all() as unknown as Array<{ id: string }>).map((row) => this.get(row.id));
  }
}
