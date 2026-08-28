import { describe, expect, it } from 'vitest';
import { VisionClient } from './vision-client.js';

describe('VisionClient', () => {
  it('correlates JSON-RPC responses and closes the worker', async () => {
    const script = `process.stdin.setEncoding('utf8');let b='';process.stdin.on('data',c=>{b+=c;let i;while((i=b.indexOf('\\n'))>=0){const r=JSON.parse(b.slice(0,i));b=b.slice(i+1);process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result:{method:r.method}})+'\\n')}})`;
    const client = new VisionClient(process.execPath, ['-e', script]);
    await expect(client.request('ping', {}, 1000)).resolves.toEqual({ method: 'ping' });
    await client.close();
  });

  it('kills a worker on timeout', async () => {
    const client = new VisionClient(process.execPath, ['-e', 'process.stdin.resume()']);
    await expect(client.request('hang', {}, 30)).rejects.toThrow('VISION_TIMEOUT');
    await client.close();
  });
});
