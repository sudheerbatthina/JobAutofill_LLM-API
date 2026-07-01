import { describe, it, expect, vi, afterEach } from 'vitest';
import { callMessages } from '@/lib/llm/claude';
import { buildEssayPrompt } from '@/lib/llm/essay';
import { RESUME_JSON_SCHEMA } from '@/lib/profile/resumePrompt';
import { ProfileSchema } from '@/lib/profile/schema';

afterEach(() => vi.restoreAllMocks());

describe('callMessages', () => {
  it('returns an error when no API key is set (no network call)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await callMessages({ apiKey: '', model: 'claude-sonnet-4-6', maxTokens: 10, messages: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/api key/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the right headers and concatenates text blocks', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] }),
        { status: 200 },
      ),
    );
    const res = await callMessages({
      apiKey: 'sk-test',
      model: 'claude-sonnet-4-6',
      maxTokens: 64,
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(res.ok).toBe(true);
    expect(res.text).toBe('Hello world');
    const [, init] = fetchSpy.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('surfaces API errors with the server message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'invalid x-api-key' } }), { status: 401 }),
    );
    const res = await callMessages({ apiKey: 'bad', model: 'claude-sonnet-4-6', maxTokens: 10, messages: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('invalid x-api-key');
  });

  it('includes output_config.format when a json schema is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }] }), { status: 200 }),
    );
    await callMessages({
      apiKey: 'sk',
      model: 'claude-sonnet-4-6',
      maxTokens: 64,
      messages: [{ role: 'user', content: 'x' }],
      jsonSchema: { type: 'object' },
    });
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.output_config.format.type).toBe('json_schema');
  });
});

describe('buildEssayPrompt', () => {
  const profile = ProfileSchema.parse({
    personal: { firstName: 'Ada', lastName: 'Lovelace' },
    skills: ['Python', 'Math'],
    experience: [{ company: 'AE', title: 'Engineer' }],
    summary: 'Pioneering programmer.',
  });

  it('grounds the prompt in profile facts and the question', () => {
    const { system, user } = buildEssayPrompt('Why do you want to work here?', profile, 'We build X');
    expect(system).toMatch(/do not invent/i);
    expect(user).toContain('Ada Lovelace');
    expect(user).toContain('Python');
    expect(user).toContain('Why do you want to work here?');
    expect(user).toContain('We build X');
  });
});

describe('RESUME_JSON_SCHEMA', () => {
  it('is a valid Anthropic structured-output shape (objects deny extra props)', () => {
    const walk = (node: any) => {
      if (node?.type === 'object') {
        expect(node.additionalProperties).toBe(false);
        expect(Array.isArray(node.required)).toBe(true);
        Object.values(node.properties ?? {}).forEach(walk);
      }
      if (node?.type === 'array') walk(node.items);
    };
    walk(RESUME_JSON_SCHEMA);
  });
});
