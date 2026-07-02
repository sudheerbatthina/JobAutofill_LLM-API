import type { AtsAdapter } from '@/lib/fields/types';
import { genericAdapter } from './generic';

/**
 * Ashby adapter. Ashby (jobs.ashbyhq.com, and embedded via an iframe on
 * company domains) renders a React form with react-select-style comboboxes
 * that the generic detector already tags as `react-select`, so detection/fill
 * are delegated. This adapter exists for recognition.
 */
export const ashbyAdapter: AtsAdapter = {
  name: 'ashby',

  matches(url, doc) {
    if (/(^|\.)ashbyhq\.com$/.test(url.hostname)) return true;
    return !!doc.querySelector('[id*="ashby_embed"], [class*="ashby-job-posting"], form[action*="ashbyhq.com"]');
  },

  detect(doc) {
    return genericAdapter.detect(doc);
  },

  fill(field, resolved) {
    return genericAdapter.fill(field, resolved);
  },
};
