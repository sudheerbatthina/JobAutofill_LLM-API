# Release Status

Living record of what is published and how to ship updates. Update this file after every release.

## Current published state
- **Store**: Chrome Web Store
- **Item name**: Free Job Autofiller
- **Publisher account**: sudheerreddy.official@gmail.com
- **Published version**: 1.0.0
- **Status**: Published - public
- **First published**: 2026-07-01
- **Last store update**: 2026-07-02
- **Users**: 1
- **Extension ID**: `jhlcejoalfnbiclndpnlhchmgaobfphd`
- **Store URL**: https://chromewebstore.google.com/detail/free-job-autofiller/jhlcejoalfnbiclndpnlhchmgaobfphd

## Local vs published
- Local repo version: 1.0.0 (see [package.json](package.json))
- Published version: 1.0.0
- **In sync**: yes — no pending update to ship as of 2026-07-06.

## How to ship an update
1. Make code changes.
2. Bump version in [package.json](package.json) (store rejects re-upload of same version).
3. Build zip: `npm run zip` → outputs `.output/wxt-react-starter-<version>-chrome.zip`.
4. Upload:
   - Manual: https://chrome.google.com/webstore/devconsole → item → Package → Upload new package → Submit.
   - Or automated: `npm run submit` (needs `.env.submit`, see [.env.submit.example](.env.submit.example)).
5. Update the "Current published state" section above with new version + date.

## Release log
| Date       | Version | Notes                         |
|------------|---------|-------------------------------|
| 2026-07-02 | 1.0.0   | Initial public release        |
