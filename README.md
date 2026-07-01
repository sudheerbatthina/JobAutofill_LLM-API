# Autofill — Personal Job Application Filler

A private Chrome extension that reads job application forms and fills them from a
profile you set up once. Per‑field, review‑before‑submit, never auto‑submits.
Optional Claude assist drafts answers to free‑text/essay questions and parses your
resume PDF into a profile — using **your own** Anthropic API key, stored locally.

Built for US STEM applications: Greenhouse, Lever, Workday, and a generic
heuristic adapter that works on most company career pages.

## How it works

- A content script detects fillable fields on the page and shows a small **⚡**
  icon next to each one. Click it to fill that field from your profile.
- Free‑text questions (e.g. "Why do you want to work here?") get an extra **✨**
  icon that asks Claude to draft an answer from your profile + the job description.
- The popup has a **"Fill all on this page"** button.
- Resume PDFs are stored locally and injected into file‑upload fields; **"Parse
  with Claude"** in settings reads the PDF in your browser and fills your profile.
- All Claude calls happen in the background service worker so your API key never
  touches page scripts. Nothing is uploaded except the explicit Claude calls you
  trigger.

## Architecture

```
entrypoints/
  background.ts     service worker — Claude API calls (essays + resume structuring)
  content.ts        injected on job pages — detects fields, mounts the ⚡/✨ icons
  popup/            "Fill all" + status
  options/          profile editor, resume upload, API key
lib/
  profile/          schema (zod) · storage (chrome.storage) · resume pdf.js + prompt
  ats/              adapters: generic · greenhouse · lever · workday · registry
  fields/           detect (label + classify) · resolve (profile→value) · inject (React-safe)
  llm/              claude (fetch client) · essay + messaging contracts
  ui/               per-field overlay (Shadow DOM)
  content/          controller wiring detection → UI → fill
```

## Develop

```sh
npm install
npm run dev      # WXT dev build with HMR
npm run build    # production build → .output/chrome-mv3
npm test         # vitest unit tests (detection, injection, adapters, LLM)
npm run compile  # tsc --noEmit typecheck
```

### Load it in Chrome

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select `.output/chrome-mv3`.
4. Open the extension **options** and fill in your profile (or upload a resume PDF
   and click **Parse with Claude** after adding your Anthropic API key).

### Try it on the sample form

Open [test/sample-form.html](test/sample-form.html) in the browser with the
extension loaded — ⚡ icons should appear next to each field. It never submits.

## Configuration

- **Anthropic API key**: paste your own key in options (stored in
  `chrome.storage.local`). Default model `claude-sonnet-4-6`; `claude-haiku-4-5`
  is a cheaper option. LLM features can be toggled off entirely.

## Notes & limits

- Never auto‑submits — you always review and submit yourself.
- Workday support covers common text/email/phone/address fields via shadow‑DOM
  piercing; its custom button dropdowns and date spinners may need manual entry.
- LinkedIn Easy Apply is out of scope for now.
- Multiple saved resumes/profiles is planned (the schema has a `label` field) but
  not yet wired in the UI.
- This is a personal‑use assistive autofiller; respect each site's terms of service.
