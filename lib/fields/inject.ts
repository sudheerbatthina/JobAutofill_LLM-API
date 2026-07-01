import type { DetectedField, ResolvedValue } from './types';

/**
 * Set the value of a React/Vue-controlled input. Assigning `.value` directly
 * doesn't notify the framework because they track the native setter; we call
 * the prototype setter then dispatch the events frameworks listen for. This is
 * the well-documented technique used by job_app_filler and similar tools.
 */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  const instanceSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
  el.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: value.slice(-1) || 'Unidentified' }));
  dispatchBeforeInput(el, value);
  if (setter && setter !== instanceSetter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.setAttribute('value', value);
  dispatchValueCommitted(el, value);
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: value.slice(-1) || 'Unidentified' }));
}

function fillTextLike(el: HTMLElement, value: string): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus();
    setNativeValue(el, value);
    el.blur();
    return true;
  }
  if (el.isContentEditable) {
    el.focus();
    el.textContent = value;
    dispatchValueCommitted(el, value);
    el.blur();
    return true;
  }
  return false;
}

function fillSelect(el: HTMLSelectElement, resolved: ResolvedValue): boolean {
  const targets = candidateValues(resolved);
  let match: HTMLOptionElement | undefined;
  for (const mode of ['exact', 'prefix', 'includes'] as const) {
    match = Array.from(el.options).find((o) => o.value && optionMatches(o.textContent || o.value, targets, mode));
    if (match) break;
  }
  if (!match) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (setter) setter.call(el, match.value);
  else el.value = match.value;
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  dispatchValueCommitted(el, match.value);
  el.blur();
  return true;
}

function fillRadio(field: DetectedField, resolved: ResolvedValue): boolean {
  const options = field.groupElements ?? [field.element];
  const want = resolved.boolValue;
  const wantTexts = candidateValues(resolved);

  const labelFor = (input: HTMLElement): string => {
    const id = input.getAttribute('id');
    const doc = input.ownerDocument;
    if (id) {
      const lbl = doc.querySelector(`label[for="${cssEscape(id)}"]`);
      if (lbl?.textContent) return norm(lbl.textContent);
    }
    const wrap = input.closest('label');
    if (wrap?.textContent) return norm(wrap.textContent);
    return norm((input as HTMLInputElement).value || '');
  };

  let target = options.find((o) => {
    const t = labelFor(o);
    if (want === true) return /^y/.test(t) || t === 'true';
    if (want === false) return /^n/.test(t) || t === 'false';
    return optionMatches(t, wantTexts, 'exact') || optionMatches(t, wantTexts, 'includes');
  });
  // Fallback: match on the raw value text.
  if (!target) target = options.find((o) => optionMatches(labelFor(o), wantTexts, 'includes'));
  if (!target) return false;

  (target as HTMLInputElement).focus();
  (target as HTMLInputElement).click();
  dispatchValueCommitted(target, resolved.value);
  return true;
}

function fillCheckbox(el: HTMLInputElement, resolved: ResolvedValue): boolean {
  const shouldCheck = resolved.boolValue ?? /^(y|true|on)/.test(norm(resolved.value));
  if (el.checked !== shouldCheck) el.click();
  dispatchValueCommitted(el, resolved.value);
  return true;
}

/**
 * Generic injection for a detected field. Adapters can override (e.g.
 * react-select). Returns true on success.
 */
export async function fillField(field: DetectedField, resolved: ResolvedValue): Promise<boolean> {
  const el = field.element;
  switch (field.control) {
    case 'text':
      return fillTextLike(el, resolved.value);
    case 'select':
      return fillSelect(el as HTMLSelectElement, resolved);
    case 'radio':
      return fillRadio(field, resolved);
    case 'checkbox':
      return fillCheckbox(el as HTMLInputElement, resolved);
    case 'react-select':
      return fillReactSelect(el, resolved);
    case 'custom-select':
      return fillCustomSelect(el, resolved);
    case 'file':
      return false; // handled by injectFile()
    default:
      return false;
  }
}

/**
 * Best-effort generic react-select / ARIA combobox handler: focus, type the
 * query, wait for options to render, then click the best match. Greenhouse's
 * adapter relies on this with an added settle delay.
 */
export async function fillReactSelect(el: HTMLElement, resolved: ResolvedValue): Promise<boolean> {
  const [value, ...aliases] = [resolved.value, ...(resolved.aliases ?? [])];
  const input = (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement | null;
  const opener = input ?? el;
  opener.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  (opener as HTMLElement).focus();

  if (input) {
    setNativeValue(input, value);
  }
  await delay(300); // let the options portal render

  const doc = el.ownerDocument;
  const wants = [value, ...aliases].map(norm).filter(Boolean);
  const options = Array.from(
    doc.querySelectorAll('[role="option"], [class*="option"]'),
  ) as HTMLElement[];
  let match = options.find((o) => optionMatches(o.textContent || '', wants, 'exact'));
  if (!match) match = options.find((o) => optionMatches(o.textContent || '', wants, 'includes'));
  if (!match) {
    opener.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    return false;
  }
  match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  match.click();
  dispatchValueCommitted(match, match.textContent || resolved.value);
  return true;
}

export async function fillCustomSelect(el: HTMLElement, resolved: ResolvedValue): Promise<boolean> {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const opener = el;
  opener.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  opener.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  opener.click();
  await delay(250);

  const wants = candidateValues(resolved);
  const options = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[role="option"], [role="menuitem"], [data-value], [class*="option"], [class*="item"], li',
    ),
  ).filter((option) => {
    const style = win?.getComputedStyle(option);
    const text = norm(option.textContent || option.getAttribute('data-value') || '');
    return text && style?.display !== 'none' && style?.visibility !== 'hidden';
  });

  let match = options.find((option) =>
    optionMatches(option.textContent || option.getAttribute('data-value') || '', wants, 'exact'),
  );
  if (!match) {
    match = options.find((option) =>
      optionMatches(option.textContent || option.getAttribute('data-value') || '', wants, 'includes'),
    );
  }
  if (!match) {
    opener.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    return false;
  }

  match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  match.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  match.click();
  dispatchValueCommitted(opener, match.textContent || resolved.value);
  return true;
}

/**
 * Inject a File (resume PDF) into a file input via DataTransfer, then fire
 * change so the page's upload handler runs.
 */
export function injectFile(input: HTMLInputElement, file: File): boolean {
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    dispatchDrag(input, 'dragenter', dt);
    dispatchDrag(input, 'dragover', dt);
    dispatchDrag(input, 'drop', dt);
    dispatchValueCommitted(input, file.name);
    return true;
  } catch {
    return false;
  }
}

export function injectResumeFile(target: Document | HTMLElement, file: File): boolean {
  const isDoc = target.nodeType === Node.DOCUMENT_NODE;
  const doc = isDoc ? (target as Document) : (target as HTMLElement).ownerDocument;
  const root = isDoc ? (doc.documentElement ?? doc) : (target as HTMLElement);
  const candidates = collectFileInputs(root);
  const ranked = candidates
    .map((input) => ({ input, score: resumeInputScore(input) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
  const inputs = ranked.length ? ranked.map((candidate) => candidate.input) : candidates;

  for (const input of inputs) {
    if (injectFile(input, file)) {
      dispatchDropOnUploadZones(doc, file, input);
      return true;
    }
  }

  return dispatchDropOnUploadZones(doc, file, null);
}

function collectFileInputs(root: Document | ShadowRoot | Element): HTMLInputElement[] {
  const out: HTMLInputElement[] = [];
  root.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => out.push(input));
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) out.push(...collectFileInputs(sr));
  });
  return out;
}

function resumeInputScore(input: HTMLInputElement): number {
  const context = [
    input.accept,
    input.name,
    input.id,
    input.getAttribute('aria-label') ?? '',
    input.getAttribute('data-automation-id') ?? '',
    input.closest('label, section, form, div')?.textContent ?? '',
  ]
    .join(' ')
    .toLowerCase();
  let score = 0;
  if (/\b(resume|cv|curriculum vitae)\b/.test(context)) score += 4;
  if (/\b(upload|drop|select file|attachment|file)\b/.test(context)) score += 2;
  if (/\.(pdf|doc|docx)|pdf|msword|word/.test(context)) score += 1;
  if (/\b(cover letter|transcript|portfolio|photo|image)\b/.test(context)) score -= 4;
  return score;
}

function dispatchDropOnUploadZones(doc: Document, file: File, input: HTMLInputElement | null): boolean {
  const dt = new DataTransfer();
  dt.items.add(file);
  const zones = collectUploadZones(doc, input);
  let dispatched = false;
  for (const zone of zones) {
    dispatchDrag(zone, 'dragenter', dt);
    dispatchDrag(zone, 'dragover', dt);
    dispatchDrag(zone, 'drop', dt);
    dispatchValueCommitted(zone, file.name);
    dispatched = true;
  }
  return dispatched;
}

function collectUploadZones(doc: Document, input: HTMLInputElement | null): HTMLElement[] {
  const direct = input
    ? ancestors(input).filter((el) => uploadZoneScore(el) > 0)
    : [];
  const global = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[class*="drop"], [class*="upload"], [id*="drop"], [id*="upload"], [data-automation-id*="upload"], [role="button"], button, a',
    ),
  ).filter((el) => uploadZoneScore(el) > 0);
  return Array.from(new Set([...direct, ...global])).slice(0, 6);
}

function ancestors(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node && out.length < 8) {
    out.push(node);
    node = node.parentElement;
  }
  return out;
}

function uploadZoneScore(el: HTMLElement): number {
  const text = [
    el.textContent ?? '',
    el.id,
    el.className,
    el.getAttribute('aria-label') ?? '',
    el.getAttribute('data-automation-id') ?? '',
  ]
    .join(' ')
    .toLowerCase();
  let score = 0;
  if (/\b(resume|cv|curriculum vitae)\b/.test(text)) score += 4;
  if (/\b(drop file|drop files|select file|select files|upload|browse)\b/.test(text)) score += 2;
  if (/\b(cover letter|transcript|portfolio|photo|image)\b/.test(text)) score -= 4;
  return score;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function candidateValues(resolved: ResolvedValue): string[] {
  return Array.from(
    new Set(
      [resolved.value, ...(resolved.aliases ?? [])]
        .flatMap((value) => [norm(value), compactNorm(value)])
        .filter(Boolean),
    ),
  );
}

function compactNorm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function optionMatches(option: string, targets: string[], mode: 'exact' | 'prefix' | 'includes'): boolean {
  const values = [norm(option), compactNorm(option)].filter(Boolean);
  return values.some((value) =>
    targets.some((target) => {
      if (mode === 'exact') return value === target;
      if (mode === 'prefix') return value.startsWith(target) || target.startsWith(value);
      return value.includes(target) || target.includes(value);
    }),
  );
}

function dispatchBeforeInput(el: HTMLElement, value: string): void {
  if (typeof InputEvent !== 'undefined') {
    el.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        composed: true,
        data: value,
        inputType: 'insertText',
      }),
    );
  }
}

function dispatchDrag(el: HTMLElement, type: string, dataTransfer: DataTransfer): void {
  if (typeof DragEvent !== 'undefined') {
    el.dispatchEvent(new DragEvent(type, { bubbles: true, composed: true, dataTransfer }));
    return;
  }
  el.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
}

function dispatchValueCommitted(el: HTMLElement, value: string): void {
  if (typeof InputEvent !== 'undefined') {
    el.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        data: value,
        inputType: 'insertText',
      }),
    );
  } else {
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  el.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
  return s.replace(/["\\]/g, '\\$&');
}
