import { storage } from 'wxt/utils/storage';
import { ProfileSchema, emptyProfile, type Profile } from './schema';

/**
 * Persistent storage wrappers. We use WXT's typed `storage` helper, which is a
 * thin wrapper over `chrome.storage`. Everything lives in `local` (not `sync`)
 * because the resume blob can exceed sync quotas and profile data is private.
 */

/** The structured profile. */
const profileItem = storage.defineItem<Profile>('local:profile', {
  fallback: emptyProfile(),
});

/** Resume file stored as a base64 data URL plus metadata. */
export interface ResumeFile {
  name: string;
  type: string; // mime, e.g. application/pdf
  dataUrl: string; // base64 data URL
  size: number;
  addedAt: number;
}
const resumeItem = storage.defineItem<ResumeFile | null>('local:resume', {
  fallback: null,
});

/** Optional cover letter PDF for file-upload fields. Same shape as ResumeFile. */
const coverLetterFileItem = storage.defineItem<ResumeFile | null>('local:coverLetterFile', {
  fallback: null,
});

/** Extension settings, incl. the bring-your-own Anthropic API key. */
export interface Settings {
  /** Master switch for content-script autofill UI and actions. */
  autofillEnabled: boolean;
  anthropicApiKey: string;
  /** Model used for resume structuring + essay drafts. */
  model: string;
  /** Whether to allow LLM calls at all. */
  llmEnabled: boolean;
}
const defaultSettings: Settings = {
  autofillEnabled: true,
  anthropicApiKey: '',
  model: 'claude-sonnet-4-6',
  llmEnabled: true,
};
const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: defaultSettings,
});

export async function getProfile(): Promise<Profile> {
  const raw = await profileItem.getValue();
  // Re-parse so older/partial stored shapes are coerced to the current schema.
  return ProfileSchema.parse(raw);
}

export async function setProfile(profile: Profile): Promise<void> {
  await profileItem.setValue(ProfileSchema.parse(profile));
}

export function watchProfile(cb: (p: Profile) => void): () => void {
  return profileItem.watch((raw) => cb(ProfileSchema.parse(raw)));
}

export async function getResume(): Promise<ResumeFile | null> {
  return resumeItem.getValue();
}

export async function setResume(file: ResumeFile | null): Promise<void> {
  await resumeItem.setValue(file);
}

export async function getCoverLetterFile(): Promise<ResumeFile | null> {
  return coverLetterFileItem.getValue();
}

export async function setCoverLetterFile(file: ResumeFile | null): Promise<void> {
  await coverLetterFileItem.setValue(file);
}

export async function getSettings(): Promise<Settings> {
  return { ...defaultSettings, ...(await settingsItem.getValue()) };
}

export async function setSettings(settings: Settings): Promise<void> {
  await settingsItem.setValue({ ...defaultSettings, ...settings });
}

export function watchSettings(cb: (settings: Settings) => void): () => void {
  return settingsItem.watch((raw) => cb({ ...defaultSettings, ...raw }));
}
