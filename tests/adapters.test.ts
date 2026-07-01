import { describe, it, expect, beforeEach } from 'vitest';
import { pickAdapter } from '@/lib/ats/registry';
import { genericAdapter } from '@/lib/ats/generic';

function setBody(html: string) {
  document.body.innerHTML = html;
}

describe('adapter selection', () => {
  beforeEach(() => setBody(''));

  it('picks greenhouse by hostname', () => {
    const a = pickAdapter(new URL('https://boards.greenhouse.io/acme/jobs/123'), document);
    expect(a.name).toBe('greenhouse');
  });

  it('picks lever by hostname', () => {
    const a = pickAdapter(new URL('https://jobs.lever.co/acme/abc'), document);
    expect(a.name).toBe('lever');
  });

  it('falls back to generic on unknown sites', () => {
    const a = pickAdapter(new URL('https://careers.example.com/apply'), document);
    expect(a.name).toBe('generic');
  });

  it('detects embedded greenhouse form on a company domain', () => {
    setBody('<div id="grnhse_app"><form><input id="job_application_x" /></form></div>');
    const a = pickAdapter(new URL('https://www.acme.com/careers/apply'), document);
    expect(a.name).toBe('greenhouse');
  });
});

describe('Lever-style name attributes', () => {
  beforeEach(() =>
    setBody(`
      <form>
        <input name="name" aria-label="Full name" />
        <input name="email" aria-label="Email" />
        <input name="phone" aria-label="Phone" />
        <input name="org" aria-label="Current company" />
        <input name="urls[LinkedIn]" aria-label="LinkedIn URL" />
        <input name="urls[GitHub]" aria-label="GitHub URL" />
      </form>`),
  );

  it('classifies Lever fields from labels/names', () => {
    const kinds = genericAdapter.detect(document).map((f) => f.kind);
    expect(kinds).toContain('fullName');
    expect(kinds).toContain('email');
    expect(kinds).toContain('phone');
    expect(kinds).toContain('company');
    expect(kinds).toContain('linkedin');
    expect(kinds).toContain('github');
  });
});

describe('react-select detection', () => {
  beforeEach(() =>
    setBody(`
      <div class="field">
        <label id="lbl-school">School</label>
        <div class="select__control">
          <div class="select__value-container">
            <input role="combobox" aria-labelledby="lbl-school" />
          </div>
        </div>
      </div>`),
  );

  it('tags react-select inputs as react-select control', () => {
    const fields = genericAdapter.detect(document);
    const school = fields.find((f) => f.kind === 'school');
    expect(school).toBeTruthy();
    expect(school!.control).toBe('react-select');
  });
});
