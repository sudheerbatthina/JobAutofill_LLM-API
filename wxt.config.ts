import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Free Job Autofiller',
    description:
      'Auto-fill job applications on Greenhouse, Lever, Workday & any career page. Resume, cover letter, EEO fields. Free & private.',
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
