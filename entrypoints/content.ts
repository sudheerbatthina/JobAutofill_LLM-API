import { Controller } from '@/lib/content/controller';

export default defineContentScript({
  // Run on known ATS hosts and, for the generic adapter, everywhere. The
  // controller gates the UI so random pages without an application form stay
  // untouched.
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main() {
    // Skip iframes for now (Workday handled in its own milestone) and non-HTML docs.
    if (window.top !== window.self) return;

    const controller = new Controller(document);
    await controller.start();

    browser.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
      if (msg?.type === 'FILL_ALL') {
        controller.fillAll().then((filled) => sendResponse({ filled }));
        return true; // async response
      }
      return false;
    });
  },
});
