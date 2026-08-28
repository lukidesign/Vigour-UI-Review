import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class VisionClient {
  private child: ChildProcessWithoutNullStreams | undefined;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private stderr = '';

  constructor(private readonly command: string, private readonly args: readonly string[]) {}

  private start() {
    if (this.child) return;
    const child = spawn(this.command, [...this.args], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    createInterface({ input: child.stdout }).on('line', (line) => this.handleLine(line));
    child.stderr.on('data', (chunk) => { this.stderr = (this.stderr + String(chunk)).slice(-4000); });
    child.once('error', () => {
      if (this.child === child) this.child = undefined;
      const error = new Error('VISION_PROCESS_START_FAILED');
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); }
      this.pending.clear();
    });
    child.once('exit', () => {
      if (this.child === child) this.child = undefined;
      const error = new Error('VISION_PROCESS_EXITED');
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); }
      this.pending.clear();
    });
  }

  private handleLine(line: string) {
    let response: { id?: number; result?: unknown; error?: { message?: string } };
    try { response = JSON.parse(line); } catch { return; }
    if (typeof response.id !== 'number') return;
    const request = this.pending.get(response.id);
    if (!request) return;
    clearTimeout(request.timer);
    this.pending.delete(response.id);
    if (response.error) request.reject(new Error(response.error.message ?? 'VISION_RPC_ERROR'));
    else request.resolve(response.result);
  }

  request(method: string, params: Record<string, unknown>, timeoutMs = 90_000): Promise<unknown> {
    this.start();
    const child = this.child!;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('VISION_TIMEOUT'));
        child.kill('SIGKILL');
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  async close() {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null) return;
    child.kill('SIGTERM');
  }
}
