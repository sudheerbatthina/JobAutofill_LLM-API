import type { Profile } from '@/lib/profile/schema';

/**
 * Canonical field kinds we know how to resolve from a Profile. `unknown` means
 * we detected an input but couldn't confidently map it (the per-field UI will
 * still offer Claude "generate" for textareas).
 */
export type FieldKind =
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'phoneExtension'
  | 'address'
  | 'addressLine2'
  | 'city'
  | 'state'
  | 'zip'
  | 'county'
  | 'country'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'website'
  | 'school'
  | 'degree'
  | 'fieldOfStudy'
  | 'gpa'
  | 'company'
  | 'jobTitle'
  | 'authorizedToWork'
  | 'requireSponsorship'
  | 'previouslyEmployed'
  | 'referralSource'
  | 'visaStatus'
  | 'gender'
  | 'race'
  | 'veteranStatus'
  | 'disabilityStatus'
  | 'hispanicLatino'
  | 'pronouns'
  | 'resume'
  | 'coverLetter'
  | 'summary'
  | 'unknown';

/** The control type, which decides how we inject a value. */
export type ControlType =
  | 'text' // input[type=text|email|tel|url], textarea, contenteditable
  | 'select' // native <select>
  | 'radio' // group of radio inputs
  | 'checkbox'
  | 'file'
  | 'react-select'; // custom combobox (Greenhouse etc.)

/** A single fillable field discovered on the page. */
export interface DetectedField {
  /** Stable id within this detection pass (used to anchor the UI). */
  id: string;
  /** The primary interactable element. */
  element: HTMLElement;
  /** For radio groups, all the option inputs. */
  groupElements?: HTMLElement[];
  control: ControlType;
  kind: FieldKind;
  /** The human label we extracted, for display + LLM context. */
  label: string;
  /** Whether the field is marked required. */
  required: boolean;
  /** Confidence 0..1 of the kind mapping (heuristic). */
  confidence: number;
}

/** Result of resolving a field's value from the profile. */
export interface ResolvedValue {
  /** The string to type, or option text to select. */
  value: string;
  /** Alternate option labels for select/radio/custom dropdown matching. */
  aliases?: string[];
  /** True boolean answer for radio/checkbox yes-no fields. */
  boolValue?: boolean;
}

/**
 * An ATS adapter knows how to recognise a site, find its fields, and fill a
 * given field. Adapters may override generic behaviour (e.g. Greenhouse's
 * react-select dropdowns) while reusing the shared detection helpers.
 */
export interface AtsAdapter {
  /** Stable id, e.g. "greenhouse". */
  name: string;
  /** Does this adapter handle the current page? */
  matches(url: URL, doc: Document): boolean;
  /** Discover all fillable fields currently in the DOM. */
  detect(doc: Document): DetectedField[];
  /**
   * Fill one field with a resolved value. Returns true on success. May be async
   * (react-select dropdowns need to wait for the portal to render).
   */
  fill(field: DetectedField, resolved: ResolvedValue): Promise<boolean>;
}

/** Context handed to value resolution. */
export interface FillContext {
  profile: Profile;
}
