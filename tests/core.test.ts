import { describe, it, expect, beforeEach } from 'vitest';
import { genericAdapter } from '@/lib/ats/generic';
import { classify, extractLabel, buildField } from '@/lib/fields/detect';
import { resolveValue } from '@/lib/fields/resolve';
import { fillField } from '@/lib/fields/inject';
import { ProfileSchema, type Profile } from '@/lib/profile/schema';
import type { DetectedField } from '@/lib/fields/types';
import { hasApplicationContext } from '@/lib/content/applicationGate';
import { expandRepeatableSections } from '@/lib/content/repeatableSections';

const profile: Profile = ProfileSchema.parse({
  personal: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '555-1234',
    city: 'Boston',
    state: 'MA',
    zip: '02118',
  },
  links: { linkedin: 'https://linkedin.com/in/ada' },
  education: [{ school: 'MIT', degree: 'BS', field: 'CS', gpa: '3.9' }],
  experience: [
    {
      company: 'Analytical Engines',
      title: 'Engineer',
      location: 'Buffalo, NY',
      startDate: 'Jan 2024',
      endDate: 'Present',
      current: true,
      description: 'Built reliable automation.',
    },
  ],
  workAuth: { authorizedToWorkUS: true, requireSponsorship: false },
  skills: ['Python'],
});

function setBody(html: string) {
  document.body.innerHTML = html;
}

function fieldByKind(fields: DetectedField[], kind: string) {
  return fields.find((f) => f.kind === kind);
}

describe('label extraction', () => {
  beforeEach(() => setBody(''));

  it('reads label[for]', () => {
    setBody('<label for="e">Email Address</label><input id="e" />');
    const el = document.getElementById('e')!;
    expect(extractLabel(el)).toBe('Email Address');
  });

  it('reads aria-label', () => {
    setBody('<input aria-label="Phone Number" />');
    expect(extractLabel(document.querySelector('input')!)).toBe('Phone Number');
  });

  it('falls back to placeholder then name', () => {
    setBody('<input placeholder="Your LinkedIn" />');
    expect(extractLabel(document.querySelector('input')!)).toBe('Your LinkedIn');
  });
});

describe('classification', () => {
  beforeEach(() => setBody(''));

  const cases: [string, string][] = [
    ['First Name', 'firstName'],
    ['Middle Name', 'middleName'],
    ['Last Name', 'lastName'],
    ['Email', 'email'],
    ['Phone', 'phone'],
    ['Phone Extension', 'phoneExtension'],
    ['LinkedIn Profile', 'linkedin'],
    ['GitHub', 'github'],
    ['School', 'school'],
    ['Work Location', 'experienceLocation'],
    ['Employment Start Date', 'experienceStartDate'],
    ['Employment End Date', 'experienceEndDate'],
    ['Responsibilities', 'experienceDescription'],
    ['Are you authorized to work in the US?', 'authorizedToWork'],
    ['Will you now or in the future require sponsorship?', 'requireSponsorship'],
    ['Have you been employed by Acme previously?', 'previouslyEmployed'],
    ['How did you hear about us?', 'referralSource'],
    ['Gender', 'gender'],
  ];

  for (const [label, kind] of cases) {
    it(`classifies "${label}" -> ${kind}`, () => {
      setBody('<input />');
      const el = document.querySelector('input')!;
      expect(classify(el, label).kind).toBe(kind);
    });
  }

  it('uses autocomplete tokens with high confidence', () => {
    setBody('<input autocomplete="family-name" />');
    const el = document.querySelector('input')!;
    const res = classify(el, '');
    expect(res.kind).toBe('lastName');
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  it('does not treat middle name as full name', () => {
    setBody('<input />');
    const el = document.querySelector('input')!;
    expect(classify(el, 'Middle Name').kind).toBe('middleName');
  });
});

describe('application page gating', () => {
  beforeEach(() => setBody(''));

  it('does not activate on a generic chat/upload page', () => {
    document.title = 'Chat';
    setBody(`
      <main>
        <h1>What's on your mind today?</h1>
        <input type="file" />
        <textarea aria-label="Ask anything"></textarea>
      </main>
    `);
    expect(hasApplicationContext(document, 0)).toBe(false);
  });

  it('activates on a job application page', () => {
    document.title = 'Job Application';
    setBody('<form><h1>Submit application</h1><label>Resume</label><input type="file" /></form>');
    expect(hasApplicationContext(document, 1)).toBe(true);
  });
});

describe('generic adapter detection (Greenhouse-like form)', () => {
  beforeEach(() =>
    setBody(`
    <form>
      <label for="first_name">First Name *</label><input id="first_name" required />
      <label for="last_name">Last Name *</label><input id="last_name" required />
      <label for="email">Email *</label><input id="email" type="email" required />
      <label for="phone">Phone</label><input id="phone" type="tel" />
      <label for="ln">LinkedIn Profile</label><input id="ln" type="url" />
      <label for="resume">Resume/CV</label><input id="resume" type="file" />
      <label for="cl">Why do you want to work here?</label><textarea id="cl"></textarea>
      <fieldset>
        <legend>Are you authorized to work in the US?</legend>
        <label><input type="radio" name="auth" value="yes" /> Yes</label>
        <label><input type="radio" name="auth" value="no" /> No</label>
      </fieldset>
    </form>
  `),
  );

  it('detects the expected field kinds', () => {
    const fields = genericAdapter.detect(document);
    const kinds = fields.map((f) => f.kind);
    expect(kinds).toContain('firstName');
    expect(kinds).toContain('lastName');
    expect(kinds).toContain('email');
    expect(kinds).toContain('phone');
    expect(kinds).toContain('linkedin');
    expect(kinds).toContain('resume');
    expect(kinds).toContain('authorizedToWork');
  });

  it('groups the radio question into a single field', () => {
    const fields = genericAdapter.detect(document);
    const auth = fieldByKind(fields, 'authorizedToWork')!;
    expect(auth.control).toBe('radio');
    expect(auth.groupElements?.length).toBe(2);
  });

  it('marks required fields', () => {
    const fields = genericAdapter.detect(document);
    expect(fieldByKind(fields, 'email')!.required).toBe(true);
  });

  it('keeps address subfields mapped independently when labels are grouped', () => {
    setBody(`
      <section>
        <h2>Address</h2>
        <label>Address Line 1</label><input id="addr" />
        <label>City</label><input id="city" />
        <label>Postal Code</label><input id="zip" />
        <label>County</label><input id="county" />
      </section>
    `);
    const byId = Object.fromEntries(genericAdapter.detect(document).map((field) => [field.element.id, field.kind]));
    expect(byId.addr).toBe('address');
    expect(byId.city).toBe('city');
    expect(byId.zip).toBe('zip');
    expect(byId.county).toBe('county');
  });

  it('detects hidden resume file inputs inside upload drop zones', () => {
    setBody(`
      <section>
        <h2>Resume/CV</h2>
        <div>Drop files here or Select files</div>
        <input id="resume-file" type="file" style="display:none" />
      </section>
    `);
    const fields = genericAdapter.detect(document);
    const resume = fields.find((field) => field.element.id === 'resume-file');
    expect(resume?.kind).toBe('resume');
    expect(resume?.control).toBe('file');
  });
});

describe('value resolution', () => {
  it('resolves personal + nested fields', () => {
    setBody('<input />');
    const el = document.querySelector('input')!;
    const mk = (kind: string): DetectedField => ({ ...buildField(el), kind: kind as any });
    expect(resolveValue(mk('email'), profile)?.value).toBe('ada@example.com');
    expect(resolveValue(mk('fullName'), profile)?.value).toBe('Ada Lovelace');
    expect(resolveValue(mk('middleName'), profile)).toBeNull();
    expect(resolveValue(mk('school'), profile)?.value).toBe('MIT');
    expect(resolveValue(mk('jobTitle'), profile)?.value).toBe('Engineer');
    expect(resolveValue(mk('experienceLocation'), profile)?.value).toBe('Buffalo, NY');
    expect(resolveValue(mk('experienceStartDate'), profile)?.value).toBe('Jan 2024');
    expect(resolveValue(mk('experienceEndDate'), profile)?.value).toBe('Present');
    expect(resolveValue(mk('experienceDescription'), profile)?.value).toBe('Built reliable automation.');
    expect(resolveValue(mk('linkedin'), profile)?.value).toBe('https://linkedin.com/in/ada');
  });

  it('resolves work-auth booleans', () => {
    setBody('<input />');
    const el = document.querySelector('input')!;
    const mk = (kind: string): DetectedField => ({ ...buildField(el), kind: kind as any });
    expect(resolveValue(mk('authorizedToWork'), profile)).toEqual({ value: 'Yes', boolValue: true });
    expect(resolveValue(mk('requireSponsorship'), profile)).toEqual({ value: 'No', boolValue: false });
    expect(resolveValue(mk('previouslyEmployed'), profile)).toEqual({ value: 'No', boolValue: false });
  });

  it('resolves common default application values', () => {
    setBody('<input />');
    const el = document.querySelector('input')!;
    const mk = (kind: string): DetectedField => ({ ...buildField(el), kind: kind as any });
    expect(resolveValue(mk('phoneExtension'), profile)).toEqual({ value: '1' });
    expect(resolveValue(mk('referralSource'), profile)?.aliases).toContain('Job Posting');
  });

  it('returns null for unknown / missing data', () => {
    setBody('<input />');
    const el = document.querySelector('input')!;
    const mk = (kind: string): DetectedField => ({ ...buildField(el), kind: kind as any });
    expect(resolveValue(mk('unknown'), profile)).toBeNull();
    expect(resolveValue(mk('portfolio'), profile)).toBeNull();
  });
});

describe('injection', () => {
  it('fills text inputs and dispatches events', async () => {
    setBody('<input id="x" />');
    const el = document.getElementById('x') as HTMLInputElement;
    let inputFired = false;
    el.addEventListener('input', () => (inputFired = true));
    const field = buildField(el);
    await fillField({ ...field, kind: 'email' as any }, { value: 'ada@example.com' });
    expect(el.value).toBe('ada@example.com');
    expect(inputFired).toBe(true);
  });

  it('selects the matching option in a native select', async () => {
    setBody('<select id="s"><option value="">--</option><option>Yes</option><option>No</option></select>');
    const el = document.getElementById('s') as HTMLSelectElement;
    const field = buildField(el);
    const ok = await fillField(field, { value: 'Yes' });
    expect(ok).toBe(true);
    expect(el.value).toBe('Yes');
  });

  it('selects a referral-source alias in a native select', async () => {
    setBody('<select id="s"><option value="">--</option><option>Job Postings</option><option>Referral</option></select>');
    const el = document.getElementById('s') as HTMLSelectElement;
    const field = buildField(el);
    const ok = await fillField(field, {
      value: 'Careers Website',
      aliases: ['Career Site', 'Job Posting', 'Job Postings'],
    });
    expect(ok).toBe(true);
    expect(el.value).toBe('Job Postings');
  });

  it('selects an option from a custom dropdown', async () => {
    setBody(`
      <label id="auth-label">Work Authorization</label>
      <button id="auth" aria-haspopup="listbox" aria-labelledby="auth-label">-None-</button>
      <div role="listbox">
        <div role="option" id="yes">Yes</div>
        <div role="option" id="no">No</div>
      </div>
    `);
    let clicked = '';
    document.getElementById('yes')!.addEventListener('click', () => {
      clicked = 'Yes';
    });
    const field = buildField(document.getElementById('auth')!);
    expect(field.control).toBe('custom-select');
    const ok = await fillField(field, { value: 'Yes', boolValue: true });
    expect(ok).toBe(true);
    expect(clicked).toBe('Yes');
  });

  it('selects the correct radio for a yes/no answer', async () => {
    setBody(`
      <fieldset>
        <legend>Authorized?</legend>
        <label><input type="radio" name="a" value="yes" /> Yes</label>
        <label><input type="radio" name="a" value="no" /> No</label>
      </fieldset>`);
    const fields = genericAdapter.detect(document);
    const field = fields.find((f) => f.control === 'radio')!;
    await fillField(field, { value: 'No', boolValue: false });
    const checked = document.querySelector('input[name="a"]:checked') as HTMLInputElement;
    expect(checked.value).toBe('no');
  });
});

describe('repeatable sections', () => {
  beforeEach(() => setBody(''));

  it('clicks unopened work experience add buttons', async () => {
    setBody(`
      <section>
        <h2>Work Experience</h2>
        <button id="add">Add</button>
      </section>
    `);
    document.getElementById('add')!.addEventListener('click', () => {
      document.querySelector('section')!.insertAdjacentHTML(
        'beforeend',
        '<label>Company</label><input id="company" />',
      );
    });
    const clicked = await expandRepeatableSections(document);
    expect(clicked).toBe(1);
    expect(document.getElementById('company')).toBeTruthy();
  });
});
