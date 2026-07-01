import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Free Job Autofiller',
    description:
      'Automatically fills job applications on Greenhouse, Lever, Workday and any company career page — from your saved profile. Per-field fill, cover letter, EEO answers, resume upload. Optional Claude AI for essay questions. Free, private, no data leaves your browser.',
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
