# Privacy Policy — Free Job Autofiller

**Last updated: July 1, 2026**

## Summary
Free Job Autofiller stores all your data locally on your device. The developer never receives, sees, or stores any of your personal information.

## Data stored locally
The extension stores the following in your browser's `chrome.storage.local` (on your device only):
- Personal profile: name, email, phone, address, work history, education, skills, EEO answers
- Resume PDF (as a base64 string)
- Cover letter text and PDF
- Your Anthropic API key (if you choose to use the Claude AI feature)

None of this data is transmitted to the developer or any third-party server controlled by the developer.

## Optional Claude AI feature
If you choose to use the "✨ Generate with Claude" feature:
- Your profile summary, skills, and the job description on the page are sent to **Anthropic's API** (api.anthropic.com) using **your own Anthropic API key**.
- This data goes to your own Anthropic account, governed by [Anthropic's Privacy Policy](https://www.anthropic.com/privacy).
- This feature is opt-in and only triggered when you explicitly click the ✨ button. It never runs automatically.

## Permissions used
- **storage**: To save your profile and settings locally on your device.
- **host permissions** (greenhouse.io, lever.co, myworkdayjobs.com, all URLs): To detect and fill form fields on job application pages. The extension reads form structure only — it does not transmit page content anywhere.

## No tracking, no analytics
The extension contains no analytics, tracking pixels, crash reporters, or advertising SDKs.

## Contact
For questions or to report an issue, open a GitHub issue at:  
https://github.com/sudheerbatthina/JobAutofill_LLM-API/issues
