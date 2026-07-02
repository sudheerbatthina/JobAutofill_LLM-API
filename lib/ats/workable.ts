import type { AtsAdapter } from '@/lib/fields/types';
import { genericAdapter } from './generic';

/**
 * Workable adapter. Workable hosts applications at apply.workable.com and
 * *.workable.com, plus an embeddable widget on company career pages. Plain
 * inputs with descriptive `name`/`id` attributes, so the generic classifier
 * handles detection/fill directly.
 */
export const workableAdapter: AtsAdapter = {
  name: 'workable',

  matches(url, doc) {
    if (/(^|\.)workable\.com$/.test(url.hostname)) return true;
    return !!doc.querySelector('form[action*="workable.com"], [id^="workable-"], whr-application-form');
  },

  detect(doc) {
    return genericAdapter.detect(doc);
  },

  fill(field, resolved) {
    return genericAdapter.fill(field, resolved);
  },
};
