import { z } from 'zod';

/**
 * The user's job-application profile. This is the single source of truth that
 * every ATS adapter fills from. Fields are tuned for US STEM applications
 * (work authorization, visa sponsorship, and EEO/demographic questions are
 * first-class because they appear on nearly every application).
 *
 * Resume binary is stored separately (see storage.ts `resumeFile`) to keep this
 * object small and easy to edit in the options page.
 */

export const PersonalSchema = z.object({
  firstName: z.string().default(''),
  lastName: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  // Location split out because forms vary between a single field and parts.
  addressLine1: z.string().default(''),
  city: z.string().default(''),
  state: z.string().default(''),
  zip: z.string().default(''),
  country: z.string().default('United States'),
});
export type Personal = z.infer<typeof PersonalSchema>;

export const LinksSchema = z.object({
  linkedin: z.string().default(''),
  github: z.string().default(''),
  portfolio: z.string().default(''),
  website: z.string().default(''),
});
export type Links = z.infer<typeof LinksSchema>;

export const EducationSchema = z.object({
  school: z.string().default(''),
  degree: z.string().default(''), // e.g. "Bachelor of Science"
  field: z.string().default(''), // e.g. "Computer Science"
  startDate: z.string().default(''), // free text, e.g. "2019" or "Aug 2019"
  endDate: z.string().default(''),
  gpa: z.string().default(''),
});
export type Education = z.infer<typeof EducationSchema>;

export const ExperienceSchema = z.object({
  company: z.string().default(''),
  title: z.string().default(''),
  location: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''), // "" or "Present"
  current: z.boolean().default(false),
  description: z.string().default(''),
});
export type Experience = z.infer<typeof ExperienceSchema>;

/**
 * Work authorization / sponsorship. These map to the canonical
 * yes/no questions almost every US application asks. Kept as explicit
 * booleans (nullable = "not answered") so the field mapper can resolve
 * radio/select options deterministically.
 */
export const WorkAuthSchema = z.object({
  authorizedToWorkUS: z.boolean().nullable().default(null),
  requireSponsorship: z.boolean().nullable().default(null),
  // Free text shown on some forms, e.g. "US Citizen", "Green Card", "F-1 OPT".
  visaStatus: z.string().default(''),
});
export type WorkAuth = z.infer<typeof WorkAuthSchema>;

/**
 * Voluntary EEO / demographic answers. Stored so the user only answers once.
 * All optional; "" / "Decline to self-identify" are valid.
 */
export const EeoSchema = z.object({
  gender: z.string().default(''),
  pronouns: z.string().default(''),
  race: z.string().default(''),
  hispanicLatino: z.string().default(''),
  veteranStatus: z.string().default(''),
  disabilityStatus: z.string().default(''),
});
export type Eeo = z.infer<typeof EeoSchema>;

export const ProfileSchema = z.object({
  /** Schema version for future migrations. */
  version: z.literal(1).default(1),
  /** Label so the user can keep multiple profiles/resumes later. */
  label: z.string().default('Default'),
  // prefault: apply `{}` then parse so each sub-schema's field defaults fill in
  // (Zod v4 `.default()` expects the full output type, `.prefault()` does not).
  personal: PersonalSchema.prefault({}),
  links: LinksSchema.prefault({}),
  education: z.array(EducationSchema).default([]),
  experience: z.array(ExperienceSchema).default([]),
  skills: z.array(z.string()).default([]),
  workAuth: WorkAuthSchema.prefault({}),
  eeo: EeoSchema.prefault({}),
  /** Free-form notes / extra context the LLM can use for essay questions. */
  summary: z.string().default(''),
  /** Cover letter body text, filled into textarea cover-letter fields. */
  coverLetter: z.string().default(''),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** A fresh, empty-but-valid profile. */
export function emptyProfile(): Profile {
  return ProfileSchema.parse({});
}
