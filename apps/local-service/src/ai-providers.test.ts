import { describe, expect, it } from 'vitest';
import { createProviderRegistry } from './ai-providers.js';

const modelOutput = { summary: '应先修复位置偏差', fixes: [{ issueId: 'issue_1', explanation: '向左修正' }], warnings: [] };

describe('AI provider adapters', () => {
  it('normalizes OpenAI and Gemini structured responses', async () => {
    const fetcher = async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.includes('openai') ? { output_text: JSON.stringify(modelOutput) } : { candidates: [{ content: { parts: [{ text: JSON.stringify(modelOutput) }] } }] };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const providers = createProviderRegistry(fetcher as typeof fetch);
    await expect(providers.openai.analyze({ model: 'gpt-5', task: 'explain', prompt: 'x' }, 'key')).resolves.toMatchObject(modelOutput);
    await expect(providers.gemini.analyze({ model: 'gemini-3.5-flash', task: 'explain', prompt: 'x' }, 'key')).resolves.toMatchObject(modelOutput);
  });

  it('does not let text-only providers silently upload images', async () => {
    const providers = createProviderRegistry();
    await expect(providers.deepseek.analyze({ model: 'deepseek-v4-flash', task: 'explain', prompt: 'x', imageDataUrl: 'data:image/png;base64,a' }, 'key')).rejects.toThrow('AI_PROVIDER_NO_IMAGE');
  });
});
