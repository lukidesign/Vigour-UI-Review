import { randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
type ImageKind = 'design' | 'implementation' | 'evidence';

interface ImageInfo { mimeType: 'image/png' | 'image/jpeg'; extension: '.png' | '.jpg'; width: number; height: number }
export interface ImageAsset extends ImageInfo { id: string; kind: ImageKind; filename: string; path: string; createdAt: string }

function pngInfo(buffer: Buffer): ImageInfo | undefined {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return undefined;
  return { mimeType: 'image/png', extension: '.png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegInfo(buffer: Buffer): ImageInfo | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1]!;
    if (marker === 0xd9 || marker === 0xda) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return undefined;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { mimeType: 'image/jpeg', extension: '.jpg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return undefined;
}

function inspect(buffer: Buffer): ImageInfo {
  const info = pngInfo(buffer) ?? jpegInfo(buffer);
  if (!info) throw new Error('INVALID_IMAGE');
  if (info.width < 1 || info.height < 1 || info.width * info.height > MAX_PIXELS) throw new Error('IMAGE_LIMIT_EXCEEDED');
  return info;
}

function rowToAsset(row: Record<string, unknown>): ImageAsset {
  return {
    id: String(row.id), kind: row.kind as ImageKind, filename: String(row.filename),
    mimeType: row.mime_type as ImageInfo['mimeType'], extension: row.mime_type === 'image/png' ? '.png' : '.jpg',
    path: String(row.path), width: Number(row.width), height: Number(row.height), createdAt: String(row.created_at),
  };
}

export class ImageStore {
  constructor(private readonly db: DatabaseSync, private readonly root: string) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
  }

  create(kind: Exclude<ImageKind, 'evidence'>, filename: string, dataUrl: string): ImageAsset {
    const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) throw new Error('INVALID_IMAGE_DATA_URL');
    const buffer = Buffer.from(match[2]!, 'base64');
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');
    const info = inspect(buffer);
    if (match[1] !== info.mimeType) throw new Error('MIME_MISMATCH');
    const id = `asset_${randomUUID().replaceAll('-', '')}`;
    const safeFilename = basename(filename).slice(0, 255) || `image${info.extension}`;
    const path = join(this.root, `${id}${info.extension}`);
    const temporary = `${path}.tmp`;
    try {
      writeFileSync(temporary, buffer, { mode: 0o600, flag: 'wx' });
      renameSync(temporary, path);
      const createdAt = new Date().toISOString();
      this.db.prepare(`INSERT INTO image_assets (id, kind, filename, mime_type, path, width, height, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, kind, safeFilename, info.mimeType, path, info.width, info.height, createdAt);
      return { id, kind, filename: safeFilename, path, createdAt, ...info };
    } catch (error) {
      rmSync(temporary, { force: true });
      rmSync(path, { force: true });
      throw error;
    }
  }

  get(id: string): ImageAsset {
    const row = this.db.prepare('SELECT * FROM image_assets WHERE id = ?').get(id) as unknown as Record<string, unknown> | undefined;
    if (!row) throw new Error('IMAGE_ASSET_NOT_FOUND');
    return rowToAsset(row);
  }

  reserveEvidence(reference: ImageAsset): { id: string; path: string } {
    const id = `asset_${randomUUID().replaceAll('-', '')}`;
    return { id, path: join(this.root, `${id}.png`) };
  }

  commitEvidence(reservation: { id: string; path: string }, reference: ImageAsset): ImageAsset {
    const createdAt = new Date().toISOString();
    this.db.prepare(`INSERT INTO image_assets (id, kind, filename, mime_type, path, width, height, created_at)
      VALUES (?, 'evidence', ?, 'image/png', ?, ?, ?, ?)`)
      .run(reservation.id, '差异证据.png', reservation.path, reference.width, reference.height, createdAt);
    return this.get(reservation.id);
  }
}
