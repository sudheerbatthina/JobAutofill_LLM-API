import type { AtsAdapter } from '@/lib/fields/types';
import { genericAdapter } from './generic';

/**
 * Lever adapter. Lever forms (jobs.lever.co) use plain inputs with telling
 * `name` attributes: `name`, `email`, `phone`, `org` (current company), and
 * `urls[LinkedIn]` / `urls[GitHub]`. The generic classifier already resolves
 * these from the name attribute, so detection/fill are delegated. This adapter
 * exists for recognition and as the hook point for Lever's Postings API schema
 * if we later want authoritative custom-question metadata.
 */
export const leverAdapter: AtsAdapter = {
  name: 'lever',

  matches(url, doc) {
    if (/(^|\.)lever\.co$/.test(url.hostname)) return true;
    return !!doc.querySelector('form[action*="lever.co"], .application-form[data-qa]');
  },

  detect(doc) {
    return genericAdapter.detect(doc);
  },

  fill(field, resolved) {
    return genericAdapter.fill(field, resolved);
  },
};
