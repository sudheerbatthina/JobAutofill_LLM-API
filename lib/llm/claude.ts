/**
 * Minimal Anthropic Messages API client for the extension's background service
 * worker. We use raw `fetch` (not the SDK) to keep the bundle small and because
 * extension service workers need the `anthropic-dangerous-direct-browser-access`
 * header to bypass CORS — the documented way to call the API directly from a
 * browser context. The API key is the user's own (bring-your-own-key), read
 * from chrome.storage and passed in here; it is never logged.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export interface ClaudeTextBlock {
  type: 'text';
  text: string;
}

export interface MessagesRequest {
  apiKey: string;
  model: string;
  maxTokens: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>;
  /** Optional structured-output JSON schema (output_config.format). */
  jsonSchema?: Record<string, unknown>;
}

export interface MessagesResult {
  ok: boolean;
  text: string;
  error?: string;
  raw?: unknown;
}

export async function callMessages(req: MessagesRequest): Promise<MessagesResult> {
  if (!req.apiKey) {
    return { ok: false, text: '', error: 'No Anthropic API key set. Add one in extension settings.' };
  }

  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens,
    messages: req.messages,
  };
  if (req.system) body.system = req.system;
  if (req.jsonSchema) {
    body.output_config = { format: { type: 'json_schema', schema: req.jsonSchema } };
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': req.apiKey,
        'anthropic-version': API_VERSION,
        // Required to call the API directly from a browser/extension context.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, text: '', error: `Network error: ${(e as Error).message}` };
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.error?.message ?? detail;
    } catch {
      /* ignore parse error */
    }
    return { ok: false, text: '', error: detail };
  }

  const data = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: ClaudeTextBlock) => b.text)
        .join('')
    : '';
  return { ok: true, text, raw: data };
}
