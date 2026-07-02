/**
 * Third-party tools (resume builders, AI resume scorers, portfolio editors)
 * often talk about "resume" and "cover letter" as much as a real application
 * form does, and some (jobright.ai's resume editor, for one) even reuse
 * career-site vocabulary in their own UI chrome. Treat these paths as
 * definitely-not-an-application regardless of how many soft signals match.
 */
const NEGATIVE_PATH_SIGNALS = [
  /\/(resume|cv)s?[-_/](edit|editor|builder|maker|create|score|scorer|analyz|review|tailor)/,
  /\bresume (builder|maker|editor|score|scorer|analyzer|checker|review)\b/,
  /\bai resume\b/,
];

export function hasApplicationContext(doc: Document, knownFieldCount: number): boolean {
  const url = doc.location?.href ?? '';
  const title = doc.title ?? '';
  const body = (doc.body?.innerText ?? '').slice(0, 12000);
  const text = `${url}\n${title}\n${body}`.toLowerCase();

  if (NEGATIVE_PATH_SIGNALS.some((signal) => signal.test(text))) return false;

  // Unambiguous signals: a real ATS platform, or explicit "apply"/"application"
  // language. These alone are enough to activate.
  const strongSignals = [
    /\/(careers?|jobs?|apply|application|candidate|recruiting)\b/,
    /\b(job application|application form|apply for this job|submit application)\b/,
    /\b(work authorization|visa sponsorship|equal employment|eeo|voluntary self[- ]identification)\b/,
    /\b(greenhouse|lever|workday|ashby|workable|icims|taleo|bamboohr|smartrecruiters|jazzhr|jobvite|breezy ?hr|recruitee|personio)\b/,
  ];
  if (strongSignals.some((signal) => signal.test(text))) return true;

  // Soft signals: common on both real application forms and unrelated tools
  // (resume builders, contact forms), so we require several of them together,
  // plus a minimum number of fields we could actually classify.
  const weakSignals = [
    /\b(first name|last name|email address|phone number)\b/,
    /\b(address line 1|postal code|zip code|linkedin|portfolio)\b/,
    /\b(how did you hear|previously employed|authorized to work)\b/,
    /\b(resume|cover letter|curriculum vitae)\b/,
  ];
  const weakCount = weakSignals.filter((signal) => signal.test(text)).length;
  return knownFieldCount >= 4 && weakCount >= 2;
}
