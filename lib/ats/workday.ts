import type { AtsAdapter, DetectedField } from '@/lib/fields/types';
import { buildField, isFillable } from '@/lib/fields/detect';
import { fillField } from '@/lib/fields/inject';

/**
 * Workday adapter. Workday (wd*.myworkdayjobs.com) is the hardest target: a
 * React SPA that renders form controls inside nested shadow roots and across
 * multiple "Save and Continue" pages, and identifies fields with
 * `data-automation-id` rather than labels. This adapter:
 *  - pierces shadow roots to find controls (the generic adapter only sees light
 *    DOM);
 *  - relies on the camelCase-tolerant classifier + `data-automation-id` haystack
 *    (see detect.ts) to map fields;
 *  - fills text/select/radio via the shared injector.
 *
 * Workday's custom button-based dropdowns and date spinners are only partially
 * supported; this adapter fills the common text, email, phone, and address
 * fields reliably and leaves exotic widgets to manual entry.
 */
export const workdayAdapter: AtsAdapter = {
  name: 'workday',

  matches(url) {
    return /(^|\.)myworkdayjobs\.com$/.test(url.hostname) || url.hostname.includes('myworkdayjobs');
  },

  detect(doc) {
    const els = deepCollect(doc, 'input, select, textarea, [contenteditable="true"]');
    const fields: DetectedField[] = [];
    const seenRadioGroups = new Set<string>();

    for (const el of els) {
      if (!isFillable(el)) continue;

      if (el instanceof HTMLInputElement && el.type === 'radio') {
        const name = el.name || el.getAttribute('data-automation-id') || '';
        if (name && seenRadioGroups.has(name)) continue;
        if (name) seenRadioGroups.add(name);
        const group = name
          ? (deepCollect(doc, 'input[type="radio"]').filter(
              (r) => (r as HTMLInputElement).name === name,
            ) as HTMLElement[])
          : [el];
        const base = buildField(el);
        fields.push({ ...base, control: 'radio', groupElements: group, element: group[0] ?? el });
        continue;
      }

      const field = buildField(el);
      if (field.kind === 'unknown' && field.control !== 'text' && field.control !== 'file') continue;
      fields.push(field);
    }
    return fields;
  },

  async fill(field, resolved) {
    return fillField(field, resolved);
  },
};

/**
 * Query an element + all of its descendant shadow roots for `selector`.
 * Workday nests controls several shadow boundaries deep, which a plain
 * querySelectorAll cannot reach.
 */
function deepCollect(root: Document | ShadowRoot | Element, selector: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  const scope: ParentNode = root instanceof Element ? root : root;

  scope.querySelectorAll<HTMLElement>(selector).forEach((el) => out.push(el));

  // Walk every element looking for open shadow roots to recurse into.
  const all = scope.querySelectorAll<HTMLElement>('*');
  all.forEach((el) => {
    const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) out.push(...deepCollect(sr, selector));
  });
  return out;
}
