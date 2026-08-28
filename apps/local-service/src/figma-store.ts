import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FigmaSemanticNode, ParsedFigmaUrl } from './figma.js';

export class FigmaStore {
  constructor(private readonly db: DatabaseSync) {}
  create(assetId: string, source: ParsedFigmaUrl, fileName: string, nodeName: string, nodes: FigmaSemanticNode[]) {
    const id = `figma_${randomUUID().replaceAll('-', '')}`;
    const importedAt = new Date().toISOString();
    this.db.prepare(`INSERT INTO figma_imports (id, asset_id, file_key, node_id, file_name, node_name, source_url, nodes_json, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, assetId, source.fileKey, source.nodeId, fileName, nodeName, source.sourceUrl, JSON.stringify(nodes), importedAt);
    return { id, assetId, fileName, nodeName, nodeCount: nodes.length, importedAt };
  }
}
