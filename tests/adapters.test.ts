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

  it('picks ashby by hostname', () => {
    const a = pickAdapter(new URL('https://jobs.ashbyhq.com/acme/abc'), document);
    expect(a.name).toBe('ashby');
  });

  it('picks workable by hostname', () => {
    const a = pickAdapter(new URL('https://apply.workable.com/acme/j/123'), document);
    expect(a.name).toBe('workable');
  });

  it('picks icims by hostname', () => {
    const a = pickAdapter(new URL('https://acme.icims.com/jobs/123/apply'), document);
    expect(a.name).toBe('icims');
  });

  it('picks smartrecruiters by hostname', () => {
    const a = pickAdapter(new URL('https://jobs.smartrecruiters.com/acme/123'), document);
    expect(a.name).toBe('smartrecruiters');
  });

  it('picks bamboohr by hostname', () => {
    const a = pickAdapter(new URL('https://acme.bamboohr.com/careers/123'), document);
    expect(a.name).toBe('bamboohr');
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
