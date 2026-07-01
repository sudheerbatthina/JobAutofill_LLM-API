import { callMessages } from '@/lib/llm/claude';
import { buildEssayPrompt } from '@/lib/llm/essay';
import { RESUME_JSON_SCHEMA, RESUME_SYSTEM, buildResumeUserPrompt } from '@/lib/profile/resumePrompt';
import { getProfile, getSettings } from '@/lib/profile/storage';
import type {
  BackgroundRequest,
  GenerateEssayResponse,
  StructureResumeResponse,
} from '@/lib/llm/messaging';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: BackgroundRequest, _sender, sendResponse) => {
    if (msg?.type === 'CLAUDE_GENERATE_ESSAY') {
      handleEssay(msg.question, msg.jobContext).then(sendResponse);
      return true; // async response
    }
    if (msg?.type === 'CLAUDE_STRUCTURE_RESUME') {
      handleResume(msg.resumeText).then(sendResponse);
      return true;
    }
    return false;
  });
});

async function handleEssay(question: string, jobContext?: string): Promise<GenerateEssayResponse> {
  const settings = await getSettings();
  if (!settings.llmEnabled) return { ok: false, text: '', error: 'LLM is disabled in settings.' };
  const profile = await getProfile();
  const { system, user } = buildEssayPrompt(question, profile, jobContext);

  const res = await callMessages({
    apiKey: settings.anthropicApiKey,
    model: settings.model,
    maxTokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return { ok: res.ok, text: res.text, error: res.error };
}

async function handleResume(resumeText: string): Promise<StructureResumeResponse> {
  const settings = await getSettings();
  if (!settings.llmEnabled) return { ok: false, error: 'LLM is disabled in settings.' };
  if (!resumeText.trim()) return { ok: false, error: 'No text extracted from the PDF.' };

  const res = await callMessages({
    apiKey: settings.anthropicApiKey,
    model: settings.model,
    maxTokens: 2048,
    system: RESUME_SYSTEM,
    messages: [{ role: 'user', content: buildResumeUserPrompt(resumeText) }],
    jsonSchema: RESUME_JSON_SCHEMA,
  });
  if (!res.ok) return { ok: false, error: res.error };

  try {
    const profile = JSON.parse(res.text);
    return { ok: true, profile };
  } catch {
    return { ok: false, error: 'Could not parse the structured profile from Claude.' };
  }
}
