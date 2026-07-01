import type { Profile } from '@/lib/profile/schema';

/** Build the system + user prompt for drafting an answer to a free-text
 * application question, grounded in the user's profile and (optionally) the job
 * description scraped from the page. */
export function buildEssayPrompt(
  question: string,
  profile: Profile,
  jobContext?: string,
): { system: string; user: string } {
  const p = profile.personal;
  const profileSummary = [
    `Name: ${[p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')}`.trim(),
    profile.summary && `Summary: ${profile.summary}`,
    profile.skills.length && `Skills: ${profile.skills.join(', ')}`,
    profile.experience.length &&
      `Experience: ${profile.experience
        .map((e) => `${e.title} at ${e.company}${e.description ? ` — ${e.description}` : ''}`)
        .join('; ')}`,
    profile.education.length &&
      `Education: ${profile.education
        .map((e) => `${e.degree} ${e.field} at ${e.school}`.trim())
        .join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const system =
    'You are helping a job applicant draft a concise, specific, first-person answer to an application question. ' +
    'Use only facts from their profile; do not invent employers, dates, or achievements. ' +
    'Write in a natural, professional tone — no clichés, no filler. Keep it under 150 words unless the question demands more. ' +
    'Return only the answer text, with no preamble or quotation marks.';

  const user = [
    `Applicant profile:\n${profileSummary}`,
    jobContext ? `\nJob description / context:\n${jobContext.slice(0, 4000)}` : '',
    `\nApplication question:\n${question}`,
  ].join('\n');

  return { system, user };
}
