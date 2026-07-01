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
  if (setter && setter !== instanceSetter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
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
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.blur();
    return true;
  }
  return false;
}

function fillSelect(el: HTMLSelectElement, value: string): boolean {
  const target = norm(value);
  let match: HTMLOptionElement | undefined;
  // exact, then startsWith, then includes
  for (const test of [
    (o: string) => o === target,
    (o: string) => o.startsWith(target) || target.startsWith(o),
    (o: string) => o.includes(target) || target.includes(o),
  ]) {
    match = Array.from(el.options).find((o) => o.value && test(norm(o.textContent || o.value)));
    if (match) break;
  }
  if (!match) return false;
  el.value = match.value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function fillRadio(field: DetectedField, resolved: ResolvedValue): boolean {
  const options = field.groupElements ?? [field.element];
  const want = resolved.boolValue;
  const wantText = norm(resolved.value);

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
    return t === wantText || t.includes(wantText);
  });
  // Fallback: match on the raw value text.
  if (!target) target = options.find((o) => labelFor(o).includes(wantText));
  if (!target) return false;

  (target as HTMLInputElement).focus();
  (target as HTMLInputElement).click();
  return true;
}

function fillCheckbox(el: HTMLInputElement, resolved: ResolvedValue): boolean {
  const shouldCheck = resolved.boolValue ?? /^(y|true|on)/.test(norm(resolved.value));
  if (el.checked !== shouldCheck) el.click();
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
      return fillSelect(el as HTMLSelectElement, resolved.value);
    case 'radio':
      return fillRadio(field, resolved);
    case 'checkbox':
      return fillCheckbox(el as HTMLInputElement, resolved);
    case 'react-select':
      return fillReactSelect(el, resolved.value);
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
export async function fillReactSelect(el: HTMLElement, value: string): Promise<boolean> {
  const input = (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement | null;
  const opener = input ?? el;
  opener.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  (opener as HTMLElement).focus();

  if (input) {
    setNativeValue(input, value);
  }
  await delay(300); // let the options portal render

  const doc = el.ownerDocument;
  const want = norm(value);
  const options = Array.from(
    doc.querySelectorAll('[role="option"], [class*="option"]'),
  ) as HTMLElement[];
  let match = options.find((o) => norm(o.textContent || '') === want);
  if (!match) match = options.find((o) => norm(o.textContent || '').includes(want));
  if (!match) {
    opener.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    return false;
  }
  match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  match.click();
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
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
  return s.replace(/["\\]/g, '\\$&');
}
