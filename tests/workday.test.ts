import { describe, it, expect, beforeEach } from 'vitest';
import { pickAdapter } from '@/lib/ats/registry';
import { workdayAdapter } from '@/lib/ats/workday';
import { classify } from '@/lib/fields/detect';

function setBody(html: string) {
  document.body.innerHTML = html;
}

describe('workday adapter selection', () => {
  it('matches myworkdayjobs hostnames', () => {
    const a = pickAdapter(new URL('https://acme.wd1.myworkdayjobs.com/en-US/careers/job/123'), document);
    expect(a.name).toBe('workday');
  });
});

describe('data-automation-id classification', () => {
  beforeEach(() => setBody(''));

  const cases: [string, string][] = [
    ['legalNameSection_firstName', 'firstName'],
    ['legalNameSection_lastName', 'lastName'],
    ['email', 'email'],
    ['phone-number', 'phone'],
    ['addressSection_city', 'city'],
    ['addressSection_postalCode', 'zip'],
  ];

  for (const [autoId, kind] of cases) {
    it(`maps data-automation-id="${autoId}" -> ${kind}`, () => {
      setBody(`<input data-automation-id="${autoId}" />`);
      const el = document.querySelector('input')!;
      expect(classify(el, '').kind).toBe(kind);
    });
  }
});

describe('workday shadow-DOM detection', () => {
  beforeEach(() => setBody(''));

  it('finds inputs nested inside shadow roots', () => {
    setBody('<div id="host"></div>');
    const host = document.getElementById('host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <input data-automation-id="email" aria-label="Email" />
      <input data-automation-id="phone-number" aria-label="Phone" />
    `;
    const fields = workdayAdapter.detect(document);
    const kinds = fields.map((f) => f.kind);
    expect(kinds).toContain('email');
    expect(kinds).toContain('phone');
  });
});
