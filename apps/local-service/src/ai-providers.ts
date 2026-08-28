import { z } from 'zod';
import type { AIProvider, AITask } from './ai-consent.js';

export const aiOutputSchema = z.object({
  summary: z.string().min(1).max(4000),
  businessLogic: z.string().max(6000).optional(),
  fixes: z.array(z.object({ issueId: z.string().max(128), explanation: z.string().max(2000), cssPatch: z.string().max(8000).optional() })).max(50),
  warnings: z.array(z.string().max(1000)).max(20).default([]),
});
export type AIOutput = z.infer<typeof aiOutputSchema>;

export interface AIRequest { model: string; task: AITask; prompt: string; imageDataUrl?: string }
export interface ProviderCapabilities { textInput: true; imageInput: boolean; structuredOutput: boolean; maxPayloadBytes: number }
export interface AIAdapter { id: AIProvider; capabilities: ProviderCapabilities; analyze(request: AIRequest, apiKey: string): Promise<AIOutput> }

const outputJsonSchema = {
  type: 'object', additionalProperties: false, required: ['summary', 'fixes', 'warnings'],
  properties: {
    summary: { type: 'string' }, businessLogic: { type: 'string' },
    fixes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['issueId', 'explanation'], properties: { issueId: { type: 'string' }, explanation: { type: 'string' }, cssPatch: { type: 'string' } } } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
};

async function checkedJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'AI_KEY_INVALID' : response.status === 429 ? 'AI_RATE_LIMITED' : 'AI_PROVIDER_FAILED');
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > 2 * 1024 * 1024) throw new Error('AI_RESPONSE_TOO_LARGE');
  const text = await response.text();
  if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new Error('AI_RESPONSE_TOO_LARGE');
  return JSON.parse(text) as Record<string, unknown>;
}

function parseModelJson(text: string): AIOutput {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return aiOutputSchema.parse(JSON.parse(cleaned));
}

abstract class BaseAdapter implements AIAdapter {
  abstract id: AIProvider;
  abstract capabilities: ProviderCapabilities;
  constructor(protected readonly fetcher: typeof fetch = fetch) {}
  abstract analyze(request: AIRequest, apiKey: string): Promise<AIOutput>;
}

export class OpenAIAdapter extends BaseAdapter {
  id = 'openai' as const;
  capabilities = { textInput: true as const, imageInput: true, structuredOutput: true, maxPayloadBytes: 20 * 1024 * 1024 };
  async analyze(request: AIRequest, apiKey: string) {
    const content: Array<Record<string, string>> = [{ type: 'input_text', text: request.prompt }];
    if (request.imageDataUrl) content.push({ type: 'input_image', image_url: request.imageDataUrl });
    const response = await this.fetcher('https://api.openai.com/v1/responses', {
      method: 'POST', signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: request.model, input: [{ role: 'user', content }], text: { format: { type: 'json_schema', name: 'vigour_ui_review', schema: outputJsonSchema, strict: true } } }),
    });
    const json = await checkedJson(response);
    const outputText = typeof json.output_text === 'string' ? json.output_text : ((json.output as Array<{ content?: Array<{ text?: string }> }> | undefined)?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join('') ?? '');
    return parseModelJson(outputText);
  }
}

export class GeminiAdapter extends BaseAdapter {
  id = 'gemini' as const;
  capabilities = { textInput: true as const, imageInput: true, structuredOutput: true, maxPayloadBytes: 20 * 1024 * 1024 };
  async analyze(request: AIRequest, apiKey: string) {
    const parts: Array<Record<string, unknown>> = [{ text: request.prompt }];
    if (request.imageDataUrl) {
      const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(request.imageDataUrl);
      if (!match) throw new Error('AI_IMAGE_INVALID');
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
    const response = await this.fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(60_000), headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', responseJsonSchema: outputJsonSchema, temperature: 0.2 } }),
    });
    const json = await checkedJson(response);
    const text = ((json.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined)?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
    return parseModelJson(text);
  }
}

class OpenAICompatibleAdapter extends BaseAdapter {
  capabilities = { textInput: true as const, imageInput: false, structuredOutput: true, maxPayloadBytes: 512 * 1024 };
  constructor(public id: 'kimi' | 'deepseek', private readonly endpoint: string, fetcher: typeof fetch = fetch) { super(fetcher); }
  async analyze(request: AIRequest, apiKey: string) {
    if (request.imageDataUrl) throw new Error('AI_PROVIDER_NO_IMAGE');
    const response = await this.fetcher(this.endpoint, {
      method: 'POST', signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: request.model, messages: [{ role: 'system', content: 'Return only valid JSON.' }, { role: 'user', content: request.prompt }], response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 3000 }),
    });
    const json = await checkedJson(response);
    const text = (json.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content ?? '';
    return parseModelJson(text);
  }
}

export function createProviderRegistry(fetcher: typeof fetch = fetch): Record<AIProvider, AIAdapter> {
  return {
    openai: new OpenAIAdapter(fetcher), gemini: new GeminiAdapter(fetcher),
    kimi: new OpenAICompatibleAdapter('kimi', 'https://api.moonshot.cn/v1/chat/completions', fetcher),
    deepseek: new OpenAICompatibleAdapter('deepseek', 'https://api.deepseek.com/chat/completions', fetcher),
  };
}
