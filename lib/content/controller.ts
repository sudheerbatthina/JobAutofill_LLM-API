import { pickAdapter } from '@/lib/ats/registry';
import { resolveValue } from '@/lib/fields/resolve';
import { injectFile, injectResumeFile, fillField } from '@/lib/fields/inject';
import { OverlayManager, type FieldAction } from '@/lib/ui/overlay';
import { getProfile, getResume, getCoverLetterFile, getSettings, watchProfile, watchSettings } from '@/lib/profile/storage';
import type { AtsAdapter, DetectedField } from '@/lib/fields/types';
import type { Profile } from '@/lib/profile/schema';
import { dataUrlToFile } from '@/lib/util/file';
import { hasApplicationContext } from './applicationGate';
import { expandRepeatableSections } from './repeatableSections';

/**
 * Orchestrates detection + the per-field UI on a single page. One instance per
 * top-level document; iframes (Workday) get their own in a later milestone.
 */
export class Controller {
  private adapter: AtsAdapter;
  private overlay: OverlayManager;
  private profile: Profile | null = null;
  private enabled = true;
  private fields: DetectedField[] = [];
  private observer?: MutationObserver;
  private debounce?: ReturnType<typeof setTimeout>;
  private unwatchProfile?: () => void;
  private unwatchSettings?: () => void;

  constructor(private doc: Document = document) {
    this.adapter = pickAdapter(new URL(location.href), doc);
    this.overlay = new OverlayManager(doc);
  }

  async start(): Promise<void> {
    this.profile = await getProfile();
    this.enabled = (await getSettings()).autofillEnabled;
    this.unwatchProfile = watchProfile((p) => {
      this.profile = p;
      this.refresh();
    });
    this.unwatchSettings = watchSettings((settings) => {
      this.enabled = settings.autofillEnabled;
      this.refresh();
    });
    this.refresh();
    this.watchDom();
  }

  /** Re-detect and re-render the per-field icons. */
  refresh = (): void => {
    if (!this.enabled) {
      this.fields = [];
      this.overlay.sync([]);
      return;
    }
    this.fields = this.adapter.detect(this.doc);
    // Only show UI when this looks like an application form (avoid noise).
    if (!this.looksLikeApplication()) {
      this.overlay.sync([]);
      return;
    }
    this.overlay.sync(this.fields.map((f) => this.toAction(f)));
  };

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.refresh();
  }

  private looksLikeApplication(): boolean {
    if (this.adapter.name !== 'generic') return true;
    const known = this.fields.filter((f) => f.kind !== 'unknown');
    const hasResumeOrCoverLetter = this.fields.some((f) => f.kind === 'resume' || f.kind === 'coverLetter');
    const hasJobSpecificQuestion = this.fields.some((f) =>
      ['authorizedToWork', 'requireSponsorship', 'previouslyEmployed', 'referralSource'].includes(f.kind),
    );
    return hasApplicationContext(this.doc, known.length) && (known.length >= 3 || hasResumeOrCoverLetter || hasJobSpecificQuestion);
  }

  private toAction(field: DetectedField): FieldAction {
    const resolved = this.profile ? resolveValue(field, this.profile) : null;
    const isFreeText =
      field.control === 'text' &&
      (field.kind === 'unknown' || field.kind === 'summary' || field.kind === 'coverLetter');
    return {
      field,
      fillable:
        !!resolved ||
        field.kind === 'resume' ||
        (field.kind === 'coverLetter' && field.control === 'file'),
      canGenerate: isFreeText,
      onFill: () => this.fillOne(field),
      onGenerate: isFreeText ? () => this.generateFor(field) : undefined,
    };
  }

  private async fillOne(field: DetectedField): Promise<boolean> {
    // Cover letter file upload → inject stored cover letter PDF.
    if (field.kind === 'coverLetter' && field.control === 'file') {
      const clf = await getCoverLetterFile();
      if (!clf) return false;
      const file = dataUrlToFile(clf.dataUrl, clf.name, clf.type);
      const ok = injectFile(field.element as HTMLInputElement, file);
      if (ok) this.overlay.flash(field);
      return ok;
    }

    // Resume file fields pull the stored resume PDF. Unknown file fields are
    // intentionally ignored so transcripts/portfolios do not get a resume.
    if (field.kind === 'resume') {
      const resume = await getResume();
      if (!resume) return false;
      const file = dataUrlToFile(resume.dataUrl, resume.name, resume.type);
      const ok =
        field.element instanceof HTMLInputElement && field.element.type === 'file'
          ? injectFile(field.element, file)
          : injectResumeFile(field.element, file);
      if (ok) this.overlay.flash(field);
      return ok;
    }

    if (!this.profile) return false;
    const resolved = resolveValue(field, this.profile);
    if (!resolved) return false;
    const ok = await this.adapter.fill(field, resolved);
    if (ok) this.overlay.flash(field);
    return ok;
  }

  /** Fill every field we have a value for. Returns count filled. */
  async fillAll(): Promise<number> {
    if (!this.enabled) return 0;

    if (this.profile) {
      const expanded = await expandRepeatableSections(this.doc);
      if (expanded) this.refresh();
    }

    let count = 0;
    if (!this.fields.some((field) => field.kind === 'resume')) {
      const resume = await getResume();
      if (resume) {
        const file = dataUrlToFile(resume.dataUrl, resume.name, resume.type);
        if (injectResumeFile(this.doc, file)) count++;
      }
    }

    for (const field of this.fields) {
      const ok = await this.fillOne(field);
      if (ok) count++;
    }
    return count;
  }

  /**
   * Ask Claude (via the background worker) to draft an answer for a free-text
   * question, then fill it. Only ever triggered by an explicit click on the ✨
   * action — never automatically.
   */
  private async generateFor(field: DetectedField): Promise<void> {
    const question = field.label || 'Tell us about yourself';
    const jobContext = scrapeJobContext(this.doc);
    let res: { ok: boolean; text: string; error?: string };
    try {
      res = (await browser.runtime.sendMessage({
        type: 'CLAUDE_GENERATE_ESSAY',
        question,
        jobContext,
      })) as { ok: boolean; text: string; error?: string };
    } catch (e) {
      res = { ok: false, text: '', error: (e as Error).message };
    }
    if (res?.ok && res.text) {
      await fillField(field, { value: res.text });
      this.overlay.flash(field);
    } else {
      // Surface the error inline without blocking the page.
      console.warn('[autofill] essay generation failed:', res?.error);
      alert(`Autofill (Claude): ${res?.error ?? 'generation failed'}`);
    }
  }

  private watchDom(): void {
    this.observer = new MutationObserver(() => {
      if (this.debounce) clearTimeout(this.debounce);
      this.debounce = setTimeout(() => this.refresh(), 350);
    });
    this.observer.observe(this.doc.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  destroy(): void {
    this.observer?.disconnect();
    this.unwatchProfile?.();
    this.unwatchSettings?.();
    this.overlay.destroy();
  }
}

/** Best-effort scrape of the job description to give Claude context. We grab the
 * largest text container that looks like a posting body, capped for token cost. */
function scrapeJobContext(doc: Document): string {
  const candidates = doc.querySelectorAll(
    '[class*="description"], [class*="posting"], [id*="content"], article, main',
  );
  let best = '';
  candidates.forEach((el) => {
    const text = (el as HTMLElement).innerText?.trim() ?? '';
    if (text.length > best.length) best = text;
  });
  return best.slice(0, 6000);
}
