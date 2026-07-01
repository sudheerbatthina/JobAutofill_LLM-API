import type { ControlType, DetectedField, FieldKind } from './types';

/**
 * Extract the best human-readable label for an input, using the documented
 * fallback chain: <label for>, ancestor <label>, aria-label/labelledby,
 * preceding label-like element, placeholder, then name/id.
 */
export function extractLabel(el: HTMLElement): string {
  const doc = el.ownerDocument;

  // 1. aria-labelledby
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const text = labelledby
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (text) return clean(text);
  }

  // 2. aria-label
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return clean(aria);

  // 3. <label for=id>
  const id = el.getAttribute('id');
  if (id) {
    // Escape for querySelector (ids can contain odd chars on ATS pages).
    const label = doc.querySelector(`label[for="${cssEscape(id)}"]`);
    if (label?.textContent?.trim()) return clean(label.textContent);
  }

  // 4. ancestor <label>
  const ancestorLabel = el.closest('label');
  if (ancestorLabel?.textContent?.trim()) return clean(ancestorLabel.textContent);

  const fileContext = fileContextLabel(el);
  if (fileContext) return clean(fileContext);

  // 5. preceding sibling label-ish element within the same field container
  const container = el.closest('div, fieldset, section, li, p');
  if (container) {
    const prev = nearestPreviousLabel(el, container);
    if (prev) return clean(prev);

    // Trust a container-level label when it is unambiguous. Some ATS rows have a
    // prefix dropdown plus the actual input under one label, so "one control" is
    // too strict; "one label" is the better guard against grouped address blocks.
    const controls = Array.from(
      container.querySelectorAll<HTMLElement>(
        'input, select, textarea, [contenteditable="true"], [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="true"]',
      ),
    ).filter((candidate) => candidate === el || isFillable(candidate));
    const labels = Array.from(container.querySelectorAll('label, .label, legend')).filter(
      (label) => label.textContent?.trim(),
    );
    const lbl = controls.length <= 1 || labels.length === 1 ? labels[0] : null;
    if (lbl?.textContent?.trim()) return clean(lbl.textContent);
  }

  // 6. placeholder
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder?.trim()) return clean(placeholder);

  // 7. name / id
  const name = el.getAttribute('name') || id || '';
  return clean(name.replace(/[_\-.]+/g, ' '));
}

function clean(s: string): string {
  return s.replace(/[\s*]+/g, ' ').replace(/\(required\)|\*/gi, '').trim();
}

function cssEscape(s: string): string {
  // Prefer native CSS.escape when available.
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
  return s.replace(/["\\]/g, '\\$&');
}

function nearestPreviousLabel(el: HTMLElement, boundary: Element): string {
  let node = el.previousElementSibling;
  while (node && node !== boundary) {
    if (node.matches('label, .label, legend')) {
      const text = node.textContent?.trim() ?? '';
      if (text) return text;
    }
    const nestedLabel = node.querySelector('label, .label, legend');
    if (nestedLabel?.textContent?.trim()) return nestedLabel.textContent;
    const text = node.textContent?.trim() ?? '';
    if (text && text.length <= 80 && !node.querySelector('input, select, textarea, [contenteditable="true"], [role="combobox"]')) {
      return text;
    }
    if (node.querySelector('input, select, textarea, [contenteditable="true"], [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="true"]')) {
      break;
    }
    node = node.previousElementSibling;
  }
  return '';
}

function fileContextLabel(el: HTMLElement): string {
  if (!(el instanceof HTMLInputElement) || el.type !== 'file') return '';
  const context = el.closest('label, .field, .form-group, section, div');
  const text = context?.textContent?.trim() ?? '';
  if (/\b(resume|cv|cover letter|upload|attachment)\b/i.test(text)) return text;
  return '';
}

/** Normalise text for matching: lowercase, collapse non-alphanumerics. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Ordered classification rules. First match wins. Each rule tests against the
 * normalised label combined with the element's name/id/autocomplete so we catch
 * both visible labels and machine attributes.
 */
interface Rule {
  kind: FieldKind;
  // Any of these (regex on normalised haystack) matches.
  any: RegExp[];
  // None of these may match (disambiguation).
  not?: RegExp[];
}

const RULES: Rule[] = [
  // Patterns are camelCase-tolerant (optional spaces) so collapsed ids like
  // "legalNameSection_firstName" -> "legalnamesection firstname" still match.
  { kind: 'email', any: [/e ?mail/] },
  { kind: 'phoneExtension', any: [/phone.*ext/, /\bext(ension)?\b/] },
  { kind: 'firstName', any: [/first ?name/, /given ?name/, /\bfname\b/, /forename/] },
  { kind: 'middleName', any: [/middle ?name/, /\bmname\b/, /middle initial/] },
  { kind: 'lastName', any: [/last ?name/, /family ?name/, /surname/, /\blname\b/] },
  {
    kind: 'fullName',
    any: [/full ?name/, /your ?name/, /legal ?name/, /applicant ?name/, /\bname\b/],
    not: [/first/, /middle/, /last/, /user ?name/, /company/, /file ?name/, /school/, /event/],
  },
  { kind: 'phone', any: [/phone/, /mobile/, /\btel\b/, /telephone/, /cell\b/], not: [/\bext(ension)?\b/] },
  { kind: 'linkedin', any: [/linked ?in/] },
  { kind: 'github', any: [/git ?hub/] },
  { kind: 'portfolio', any: [/portfolio/, /personal site/] },
  { kind: 'website', any: [/website/, /\burl\b/, /web site/], not: [/portfolio/] },
  { kind: 'addressLine2', any: [/address line 2/, /address 2/, /apt/, /apartment/, /suite/] },
  { kind: 'city', any: [/\bcity\b/, /town/] },
  { kind: 'state', any: [/\bstate\b/, /province/, /region/] },
  { kind: 'zip', any: [/zip/, /postal/, /post code/] },
  { kind: 'county', any: [/\bcounty\b/] },
  { kind: 'address', any: [/street/, /address line 1/, /address 1/, /\baddress\b/], not: [/email/, /ip/, /\bcity\b/, /\bstate\b/, /province/, /region/, /zip/, /postal/, /\bcounty\b/] },
  { kind: 'country', any: [/country/] },
  { kind: 'school', any: [/school/, /university/, /college/, /institution/] },
  { kind: 'degree', any: [/degree/, /qualification/] },
  { kind: 'fieldOfStudy', any: [/field of study/, /major/, /discipline/, /concentration/] },
  { kind: 'gpa', any: [/\bgpa\b/, /grade point/] },
  { kind: 'educationStartDate', any: [/education.*start/, /school.*start/, /start date/], not: [/work/, /job/, /employ/, /company/] },
  { kind: 'educationEndDate', any: [/education.*end/, /school.*end/, /graduat/, /end date/], not: [/work/, /job/, /employ/, /company/] },
  { kind: 'company', any: [/current company/, /current employer/, /\bemployer\b/, /\bcompany\b/] },
  { kind: 'jobTitle', any: [/current title/, /job title/, /\btitle\b/, /position/, /\brole\b/] },
  { kind: 'experienceLocation', any: [/work.*location/, /job.*location/, /company.*location/, /employment.*location/, /\blocation\b/] },
  { kind: 'experienceStartDate', any: [/work.*start/, /job.*start/, /employment.*start/, /start date/] },
  { kind: 'experienceEndDate', any: [/work.*end/, /job.*end/, /employment.*end/, /end date/] },
  { kind: 'experienceDescription', any: [/description/, /responsibilit/, /duties/, /summary of work/] },
  {
    kind: 'authorizedToWork',
    any: [/authoriz/, /legally (allowed|able) to work/, /eligible to work/, /right to work/],
  },
  {
    kind: 'requireSponsorship',
    any: [/sponsor/, /require.*visa/, /need.*sponsorship/],
  },
  {
    kind: 'previouslyEmployed',
    any: [/previously employed/, /worked.*previously/, /employed.*previously/, /worked.*before/, /former employee/],
  },
  {
    kind: 'referralSource',
    any: [/how.*hear/, /hear.*about/, /source/, /where.*find/, /how.*learn.*(job|role|position)/],
  },
  { kind: 'visaStatus', any: [/visa/, /work permit/, /citizenship status/, /immigration/] },
  { kind: 'hispanicLatino', any: [/hispanic/, /latino/, /latinx/] },
  { kind: 'gender', any: [/gender/, /\bsex\b/] },
  { kind: 'pronouns', any: [/pronoun/] },
  { kind: 'race', any: [/race/, /ethnicit/] },
  { kind: 'veteranStatus', any: [/veteran/, /military/] },
  { kind: 'disabilityStatus', any: [/disability/, /disabled/] },
  { kind: 'resume', any: [/resume/, /\bcv\b/, /curriculum vitae/] },
  { kind: 'coverLetter', any: [/cover letter/, /motivation letter/] },
  { kind: 'summary', any: [/summary/, /about you/, /tell us about/, /why .* (you|interested)/] },
];

export function classify(el: HTMLElement, label: string): { kind: FieldKind; confidence: number } {
  const haystack = norm(
    [
      label,
      el.getAttribute('name') ?? '',
      el.getAttribute('id') ?? '',
      el.getAttribute('autocomplete') ?? '',
      el.getAttribute('data-qa') ?? '',
      // Workday and many ATS pages put the field identity here.
      el.getAttribute('data-automation-id') ?? '',
      el.getAttribute('data-test-id') ?? '',
      el.getAttribute('aria-haspopup') ?? '',
      sectionContext(el),
      el.textContent ?? '',
    ].join(' '),
  );

  // Strong signal from autocomplete tokens.
  const ac = el.getAttribute('autocomplete') ?? '';
  const acMap: Record<string, FieldKind> = {
    'given-name': 'firstName',
    'additional-name': 'middleName',
    'family-name': 'lastName',
    name: 'fullName',
    email: 'email',
    tel: 'phone',
    'tel-extension': 'phoneExtension',
    'street-address': 'address',
    'address-line1': 'address',
    'address-line2': 'addressLine2',
    'address-level2': 'city',
    'address-level1': 'state',
    'postal-code': 'zip',
    'country-name': 'country',
    organization: 'company',
    'organization-title': 'jobTitle',
  };
  if (ac && acMap[ac]) return { kind: acMap[ac], confidence: 0.95 };

  for (const rule of RULES) {
    if (rule.not?.some((r) => r.test(haystack))) continue;
    if (rule.any.some((r) => r.test(haystack))) {
      return { kind: rule.kind, confidence: 0.8 };
    }
  }
  return { kind: 'unknown', confidence: 0 };
}

/** A react-select widget renders BEM classes like `select__control`. */
function inReactSelect(el: HTMLElement): boolean {
  return !!el.closest('[class*="select__control"], [class*="select__value-container"]');
}

/** Decide the control type for injection. */
export function controlTypeOf(el: HTMLElement): ControlType {
  const tag = el.tagName.toLowerCase();
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'text';
  if (el.isContentEditable) return 'text';
  if (tag === 'input') {
    const t = (el as HTMLInputElement).type;
    if (t === 'file') return 'file';
    if (t === 'radio') return 'radio';
    if (t === 'checkbox') return 'checkbox';
    // react-select renders a text input inside a `select__control` container.
    if (inReactSelect(el)) return 'react-select';
    return 'text';
  }
  if (isCustomSelect(el)) return 'custom-select';
  // ARIA combobox div (custom dropdowns).
  if (el.getAttribute('role') === 'combobox') return 'react-select';
  return 'text';
}

function isCustomSelect(el: HTMLElement): boolean {
  const role = el.getAttribute('role');
  const popup = el.getAttribute('aria-haspopup');
  return role === 'button' || role === 'listbox' || popup === 'listbox' || popup === 'true';
}

function sectionContext(el: HTMLElement): string {
  const section = el.closest('fieldset, section, .section, .form-section, div');
  const heading = section?.querySelector('legend, h1, h2, h3, h4, [class*="title"], [class*="heading"]');
  return heading?.textContent?.trim() ?? '';
}

/** Is this element something we should consider filling? */
export function isFillable(el: HTMLElement): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' && (el as HTMLInputElement).type === 'file') return true;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  if (tag === 'select' || tag === 'textarea') return true;
  if (el.isContentEditable) return true;
  if (tag === 'input') {
    const t = (el as HTMLInputElement).type;
    return !['hidden', 'submit', 'button', 'reset', 'image', 'search'].includes(t);
  }
  if (isCustomSelect(el)) return true;
  return false;
}

let idCounter = 0;
/** Build a DetectedField from a raw element using the generic heuristics. */
export function buildField(el: HTMLElement): DetectedField {
  const label = extractLabel(el);
  const { kind, confidence } = classify(el, label);
  const control = controlTypeOf(el);
  const required =
    el.hasAttribute('required') ||
    el.getAttribute('aria-required') === 'true' ||
    /\*/.test(el.closest('label, .field, div')?.textContent ?? '');
  return {
    id: `af-${idCounter++}`,
    element: el,
    control,
    kind,
    label,
    required,
    confidence,
  };
}
