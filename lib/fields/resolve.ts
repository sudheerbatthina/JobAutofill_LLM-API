import type { Profile } from '@/lib/profile/schema';
import type { DetectedField, ResolvedValue } from './types';

/**
 * Map a detected field to a concrete value from the profile. Returns null when
 * we have no data for that kind (e.g. empty profile field or `unknown` kind).
 * The most recent education/experience entry is used for school/company fields.
 */
export function resolveValue(field: DetectedField, profile: Profile): ResolvedValue | null {
  const { personal, links, workAuth, eeo } = profile;
  const edu = profile.education[0];
  const exp = profile.experience[0];

  const text = (v: string | undefined): ResolvedValue | null =>
    v && v.trim() ? { value: v } : null;

  switch (field.kind) {
    case 'firstName':
      return text(personal.firstName);
    case 'middleName':
      return text(personal.middleName);
    case 'lastName':
      return text(personal.lastName);
    case 'fullName':
      return text([personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' '));
    case 'email':
      return text(personal.email);
    case 'phone':
      return text(personal.phone);
    case 'phoneExtension':
      return { value: '1' };
    case 'address':
      return text(personal.addressLine1);
    case 'addressLine2':
      return null;
    case 'city':
      return text(personal.city);
    case 'state':
      return withAliases(personal.state, stateAliases(personal.state));
    case 'zip':
      return text(personal.zip);
    case 'county':
      return null;
    case 'country':
      return withAliases(personal.country, countryAliases(personal.country));
    case 'linkedin':
      return text(links.linkedin);
    case 'github':
      return text(links.github);
    case 'portfolio':
      return text(links.portfolio);
    case 'website':
      return text(links.website || links.portfolio);
    case 'school':
      return text(edu?.school);
    case 'degree':
      return text(edu?.degree);
    case 'fieldOfStudy':
      return text(edu?.field);
    case 'gpa':
      return text(edu?.gpa);
    case 'company':
      return text(exp?.company);
    case 'jobTitle':
      return text(exp?.title);
    case 'experienceLocation':
      return text(exp?.location);
    case 'experienceStartDate':
      return text(exp?.startDate);
    case 'experienceEndDate':
      return text(exp?.current ? 'Present' : exp?.endDate);
    case 'experienceDescription':
      return text(exp?.description);
    case 'educationStartDate':
      return text(edu?.startDate);
    case 'educationEndDate':
      return text(edu?.endDate);
    case 'visaStatus':
      return text(workAuth.visaStatus);
    case 'gender':
      return text(eeo.gender);
    case 'pronouns':
      return text(eeo.pronouns);
    case 'race':
      return text(eeo.race);
    case 'veteranStatus':
      return text(eeo.veteranStatus);
    case 'disabilityStatus':
      return text(eeo.disabilityStatus);
    case 'hispanicLatino':
      return text(eeo.hispanicLatino);
    case 'summary':
      return text(profile.summary);
    case 'previouslyEmployed':
      return { value: 'No', boolValue: false };
    case 'referralSource':
      return {
        value: 'Careers Website',
        aliases: ['Career Site', 'Careers Site', 'Job Posting', 'Job Postings', 'Job Board'],
      };

    case 'authorizedToWork': {
      if (workAuth.authorizedToWorkUS == null) return null;
      return {
        value: workAuth.authorizedToWorkUS ? 'Yes' : 'No',
        boolValue: workAuth.authorizedToWorkUS,
      };
    }
    case 'requireSponsorship': {
      if (workAuth.requireSponsorship == null) return null;
      return {
        value: workAuth.requireSponsorship ? 'Yes' : 'No',
        boolValue: workAuth.requireSponsorship,
      };
    }

    case 'coverLetter':
      // Text/textarea cover letter fields → fill from stored text.
      // File-upload cover letter fields are handled separately in the controller.
      return text(profile.coverLetter);

    // resume file injection is handled in the controller, not here.
    case 'resume':
    case 'unknown':
    default:
      return null;
  }
}

function withAliases(value: string | undefined, aliases: string[]): ResolvedValue | null {
  if (!value?.trim() && !aliases.length) return null;
  return { value: aliases[0] || value || '', aliases: aliases.slice(1) };
}

function stateAliases(value: string | undefined): string[] {
  const raw = value?.trim();
  if (!raw) return [];
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = US_STATES.find(
    (state) =>
      state.code.toLowerCase() === compact ||
      state.name.toLowerCase().replace(/[^a-z0-9]/g, '') === compact,
  );
  if (!match) return [raw];
  return Array.from(new Set([match.name, match.code, raw]));
}

function countryAliases(value: string | undefined): string[] {
  const raw = value?.trim();
  if (!raw) return [];
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['us', 'usa', 'unitedstates', 'unitedstatesofamerica'].includes(compact)) {
    return ['United States of America', 'United States', 'USA', 'US', raw];
  }
  return [raw];
}

const US_STATES = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
].map(([code, name]) => ({ code, name }));
