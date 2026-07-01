import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Autofill — Personal Job Application Filler',
    description:
      'Reads job application forms and fills them from your saved profile. Per-field, review-before-submit. Optional Claude assist for essay questions.',
    permissions: ['storage'],
    host_permissions: [
      '*://*.greenhouse.io/*',
      '*://*.lever.co/*',
      '*://*.myworkdayjobs.com/*',
      // Claude API, called from the background service worker.
      'https://api.anthropic.com/*',
      // Generic adapter needs to run on arbitrary company career pages.
      '<all_urls>',
    ],
  },
});
