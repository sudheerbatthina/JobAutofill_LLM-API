import type { AtsAdapter } from '@/lib/fields/types';
import { genericAdapter } from './generic';

/**
 * Greenhouse adapter. Greenhouse renders a React form with `select__` (react-
 * select) dropdowns for things like school, degree and EEO answers. The generic
 * detector already tags those inputs as `react-select` (see controlTypeOf), and
 * the injector opens the dropdown + waits 300ms for the options portal before
 * clicking — which is exactly what Greenhouse needs. So this adapter mostly
 * provides recognition; detection/fill are delegated to the generic pipeline.
 */
export const greenhouseAdapter: AtsAdapter = {
  name: 'greenhouse',

  matches(url, doc) {
    if (/(^|\.)greenhouse\.io$/.test(url.hostname)) return true;
    if (url.hostname.startsWith('job-boards.greenhouse.io')) return true;
    // Embedded Greenhouse board on a company domain.
    return !!doc.querySelector(
      '#application_form, #grnhse_app, [id^="job_application"], form[action*="greenhouse"]',
    );
  },

  detect(doc) {
    return genericAdapter.detect(doc);
  },

  fill(field, resolved) {
    return genericAdapter.fill(field, resolved);
  },
};
