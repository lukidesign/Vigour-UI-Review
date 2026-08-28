export interface ParsedFigmaUrl { fileKey: string; nodeId: string; sourceUrl: string }
export interface FigmaSemanticNode {
  id: string; parentId?: string; name: string; type: string; text?: string;
  rect?: { x: number; y: number; width: number; height: number };
  fills?: unknown; strokes?: unknown; style?: unknown;
}

const MAX_JSON_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) || (parts[0] === 192 && parts[1] === 168);
}

export function parseFigmaUrl(value: string): ParsedFigmaUrl {
  const url = new URL(value);
  if (!['figma.com', 'www.figma.com'].includes(url.hostname) || url.protocol !== 'https:') throw new Error('INVALID_FIGMA_URL');
  const match = /^\/(?:design|file|proto)\/([A-Za-z0-9]+)(?:\/|$)/.exec(url.pathname);
  const rawNodeId = url.searchParams.get('node-id');
  if (!match?.[1] || !rawNodeId || !/^\d+(?:[:-])\d+$/.test(rawNodeId)) throw new Error('FIGMA_NODE_URL_REQUIRED');
  return { fileKey: match[1], nodeId: rawNodeId.replace('-', ':'), sourceUrl: url.toString() };
}

async function figmaJson(url: URL, token: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers: { 'X-Figma-Token': token }, signal: AbortSignal.timeout(30_000), redirect: 'error' });
  if (!response.ok) throw new Error(response.status === 403 ? 'FIGMA_TOKEN_INVALID' : response.status === 404 ? 'FIGMA_NODE_NOT_FOUND' : response.status === 429 ? 'FIGMA_RATE_LIMITED' : 'FIGMA_API_FAILED');
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_JSON_BYTES) throw new Error('FIGMA_RESPONSE_TOO_LARGE');
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_JSON_BYTES) throw new Error('FIGMA_RESPONSE_TOO_LARGE');
  return JSON.parse(text) as Record<string, unknown>;
}

function flattenNode(root: Record<string, unknown>): FigmaSemanticNode[] {
  const output: FigmaSemanticNode[] = [];
  const visit = (node: Record<string, unknown>, parentId?: string) => {
    if (output.length >= 20_000) throw new Error('FIGMA_NODE_LIMIT_EXCEEDED');
    const id = String(node.id ?? '');
    const bounds = node.absoluteBoundingBox as Record<string, number> | undefined;
    const rect = bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every((value) => typeof value === 'number' && Number.isFinite(value))
      ? { x: bounds.x!, y: bounds.y!, width: bounds.width!, height: bounds.height! } : undefined;
    output.push({
      id, ...(parentId ? { parentId } : {}), name: String(node.name ?? ''), type: String(node.type ?? ''),
      ...(typeof node.characters === 'string' ? { text: node.characters.slice(0, 2000) } : {}),
      ...(rect ? { rect } : {}),
      ...(node.fills ? { fills: node.fills } : {}), ...(node.strokes ? { strokes: node.strokes } : {}), ...(node.style ? { style: node.style } : {}),
    });
    const children = node.children;
    if (Array.isArray(children)) for (const child of children) if (child && typeof child === 'object') visit(child as Record<string, unknown>, id);
  };
  visit(root);
  return output;
}

export class FigmaClient {
  async importFrame(source: ParsedFigmaUrl, token: string): Promise<{ fileName: string; nodeName: string; nodes: FigmaSemanticNode[]; image: Buffer }> {
    const nodeUrl = new URL(`https://api.figma.com/v1/files/${encodeURIComponent(source.fileKey)}/nodes`);
    nodeUrl.searchParams.set('ids', source.nodeId); nodeUrl.searchParams.set('geometry', 'paths');
    const nodeResponse = await figmaJson(nodeUrl, token);
    const nodesMap = nodeResponse.nodes as Record<string, { document?: Record<string, unknown> } | null> | undefined;
    const document = nodesMap?.[source.nodeId]?.document;
    if (!document) throw new Error('FIGMA_NODE_NOT_FOUND');

    const imageUrl = new URL(`https://api.figma.com/v1/images/${encodeURIComponent(source.fileKey)}`);
    imageUrl.searchParams.set('ids', source.nodeId); imageUrl.searchParams.set('format', 'png'); imageUrl.searchParams.set('scale', '1');
    const imageResponse = await figmaJson(imageUrl, token);
    const rendered = (imageResponse.images as Record<string, string | null> | undefined)?.[source.nodeId];
    if (!rendered) throw new Error('FIGMA_RENDER_FAILED');
    const downloadUrl = new URL(rendered);
    if (downloadUrl.protocol !== 'https:' || isPrivateHostname(downloadUrl.hostname)) throw new Error('FIGMA_RENDER_URL_REJECTED');
    const response = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
    if (!response.ok) throw new Error('FIGMA_RENDER_DOWNLOAD_FAILED');
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_IMAGE_BYTES) throw new Error('FIGMA_RENDER_TOO_LARGE');
    const image = Buffer.from(await response.arrayBuffer());
    if (image.length > MAX_IMAGE_BYTES) throw new Error('FIGMA_RENDER_TOO_LARGE');
    return { fileName: String(nodeResponse.name ?? ''), nodeName: String(document.name ?? ''), nodes: flattenNode(document), image };
  }
}
