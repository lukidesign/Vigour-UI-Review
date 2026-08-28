import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export type AIProvider = 'openai' | 'gemini' | 'kimi' | 'deepseek';
export type AITask = 'explain' | 'business-logic';

export function payloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export class AIConsentStore {
  constructor(private readonly db: DatabaseSync) {}

  create(provider: AIProvider, model: string, task: AITask, dataTypes: readonly string[], hash: string) {
    const id = `consent_${randomUUID().replaceAll('-', '')}`;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 10 * 60_000);
    this.db.prepare(`INSERT INTO ai_consent_receipts
      (id, provider, model, task, data_types_json, payload_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, provider, model, task, JSON.stringify(dataTypes), hash, expiresAt.toISOString(), createdAt.toISOString());
    return { id, provider, model, task, dataTypes, payloadHash: hash, expiresAt: expiresAt.toISOString() };
  }

  consume(id: string, provider: AIProvider, model: string, task: AITask, hash: string): void {
    const now = new Date().toISOString();
    const result = this.db.prepare(`UPDATE ai_consent_receipts SET used_at = ?
      WHERE id = ? AND provider = ? AND model = ? AND task = ? AND payload_hash = ?
        AND used_at IS NULL AND expires_at > ?`)
      .run(now, id, provider, model, task, hash, now);
    if (result.changes !== 1) throw new Error('CONSENT_INVALID_OR_EXPIRED');
  }
}
