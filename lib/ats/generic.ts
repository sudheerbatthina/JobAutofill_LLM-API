import type { AtsAdapter, DetectedField } from '@/lib/fields/types';
import { buildField, classify, controlTypeOf, extractLabel, isFillable } from '@/lib/fields/detect';
import { fillField } from '@/lib/fields/inject';

/**
 * Generic heuristic adapter. Works on arbitrary company career pages by
 * scanning for fillable controls and classifying them by label/name/aria.
 * Specific ATS adapters extend or override pieces of this.
 */
export const genericAdapter: AtsAdapter = {
  name: 'generic',

  matches() {
    return true; // registry uses this as the fallback
  },

  detect(doc) {
    const fields: DetectedField[] = [];
    const seenRadioGroups = new Set<string>();

    const candidates = Array.from(
      doc.querySelectorAll<HTMLElement>(
        'input, select, textarea, [contenteditable="true"], [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="true"], [role="button"]',
      ),
    );

    for (const el of candidates) {
      if (!isFillable(el)) continue;

      // Group radios by name so the whole question is one field.
      if (el instanceof HTMLInputElement && el.type === 'radio') {
        const name = el.name || el.closest('fieldset')?.getAttribute('id') || '';
        const groupKey = `${name}@${el.form ? 'f' : 'nf'}`;
        if (name && seenRadioGroups.has(groupKey)) continue;
        if (name) seenRadioGroups.add(groupKey);

        const group = name
          ? (Array.from(doc.querySelectorAll<HTMLElement>(`input[type="radio"][name="${cssEscape(name)}"]`)))
          : [el];
        const label = groupLabel(el) || extractLabel(el);
        const { kind, confidence } = classify(el, label);
        fields.push({
          id: `af-radio-${fields.length}`,
          element: group[0],
          groupElements: group,
          control: 'radio',
          kind,
          label,
          required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
          confidence,
        });
        continue;
      }

      const field = buildField(el);
      // Skip controls we can't map and that aren't free-text (nothing to offer).
      if (field.kind === 'unknown' && field.control !== 'text' && field.control !== 'file') {
        continue;
      }
      fields.push(field);
    }

    return fields;
  },

  async fill(field, resolved) {
    return fillField(field, resolved);
  },
};

/** For a radio option, find the question label (usually a legend/fieldset). */
function groupLabel(el: HTMLElement): string {
  const fs = el.closest('fieldset');
  const legend = fs?.querySelector('legend');
  if (legend?.textContent?.trim()) return legend.textContent.replace(/\*/g, '').trim();
  const group = el.closest('[role="radiogroup"]');
  const aria = group?.getAttribute('aria-label');
  if (aria) return aria;
  return '';
}

function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
  return s.replace(/["\\]/g, '\\$&');
}

export { controlTypeOf };
