import type { AtsAdapter } from '@/lib/fields/types';
import { genericAdapter } from './generic';

/**
 * BambooHR adapter. Careers pages live at *.bamboohr.com/careers/ or an
 * embedded widget on the company domain. Standard form controls, so
 * detection/fill are delegated to the generic pipeline.
 */
export const bambooHrAdapter: AtsAdapter = {
  name: 'bamboohr',

  matches(url, doc) {
    if (/(^|\.)bamboohr\.com$/.test(url.hostname)) return true;
    return !!doc.querySelector('form[action*="bamboohr.com"], [class*="bamboohr-ats"]');
  },

  detect(doc) {
    return genericAdapter.detect(doc);
  },

  fill(field, resolved) {
    return genericAdapter.fill(field, resolved);
  },
};
