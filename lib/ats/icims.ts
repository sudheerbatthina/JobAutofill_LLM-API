import type { AtsAdapter } from '@/lib/fields/types';
import { genericAdapter } from './generic';

/**
 * iCIMS adapter. iCIMS careers sites live on *.icims.com (and are often
 * embedded in an iframe on the company's own domain, which the content
 * script does not currently enter — see the `window.top` check in
 * content.ts). Detection/fill are delegated to the generic pipeline; this
 * adapter exists for recognition and future iCIMS-specific tweaks (its older
 * pages render fields inside legacy table layouts with sparse labels).
 */
export const icimsAdapter: AtsAdapter = {
  name: 'icims',

  matches(url, doc) {
    if (/(^|\.)icims\.com$/.test(url.hostname)) return true;
    return !!doc.querySelector('form[action*="icims.com"], [id*="icims_content_iframe"]');
  },

  detect(doc) {
    return genericAdapter.detect(doc);
  },

  fill(field, resolved) {
    return genericAdapter.fill(field, resolved);
  },
};
