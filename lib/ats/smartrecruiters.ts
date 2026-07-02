import type { AtsAdapter } from '@/lib/fields/types';
import { genericAdapter } from './generic';

/**
 * SmartRecruiters adapter. Applications live at jobs.smartrecruiters.com or
 * an embedded widget on the company domain. Standard form controls, so
 * detection/fill are delegated to the generic pipeline.
 */
export const smartRecruitersAdapter: AtsAdapter = {
  name: 'smartrecruiters',

  matches(url, doc) {
    if (/(^|\.)smartrecruiters\.com$/.test(url.hostname)) return true;
    return !!doc.querySelector('form[action*="smartrecruiters.com"], [id*="smartrecruiters"]');
  },

  detect(doc) {
    return genericAdapter.detect(doc);
  },

  fill(field, resolved) {
    return genericAdapter.fill(field, resolved);
  },
};
