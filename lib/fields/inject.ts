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
  // exact, then startsWith, then includes
  for (const test of [
    (option: string, target: string) => option === target,
    (option: string, target: string) => option.startsWith(target) || target.startsWith(option),
    (option: string, target: string) => option.includes(target) || target.includes(option),
  ]) {
    for (const target of targets) {
      match = Array.from(el.options).find((o) => o.value && test(norm(o.textContent || o.value), target));
      if (match) break;
    }
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
    return wantTexts.some((wantText) => t === wantText || t.includes(wantText));
  });
  // Fallback: match on the raw value text.
  if (!target) target = options.find((o) => wantTexts.some((wantText) => labelFor(o).includes(wantText)));
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
  let match = options.find((o) => wants.some((want) => norm(o.textContent || '') === want));
  if (!match) match = options.find((o) => wants.some((want) => norm(o.textContent || '').includes(want)));
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

  let match = options.find((option) => wants.some((want) => norm(option.textContent || option.getAttribute('data-value') || '') === want));
  if (!match) match = options.find((option) => wants.some((want) => norm(option.textContent || option.getAttribute('data-value') || '').includes(want)));
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
    input.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
    input.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    dispatchValueCommitted(input, file.name);
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

function candidateValues(resolved: ResolvedValue): string[] {
  return [resolved.value, ...(resolved.aliases ?? [])].map(norm).filter(Boolean);
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
