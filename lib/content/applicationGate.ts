export function hasApplicationContext(doc: Document, knownFieldCount: number): boolean {
  const url = doc.location?.href ?? '';
  const title = doc.title ?? '';
  const body = (doc.body?.innerText ?? '').slice(0, 12000);
  const text = `${url}\n${title}\n${body}`.toLowerCase();

  const strongSignals = [
    /\/(careers?|jobs?|apply|application|candidate|recruiting)\b/,
    /\b(job application|application form|apply for this job|submit application)\b/,
    /\b(resume|cover letter|work authorization|visa sponsorship|equal employment|eeo)\b/,
    /\b(greenhouse|lever|workday|ashby|workable|icims|taleo|bamboohr)\b/,
  ];
  if (strongSignals.some((signal) => signal.test(text))) return true;

  const weakSignals = [
    /\b(first name|last name|email address|phone number)\b/,
    /\b(address line 1|postal code|zip code|linkedin|portfolio)\b/,
    /\b(how did you hear|previously employed|authorized to work)\b/,
  ];
  const weakCount = weakSignals.filter((signal) => signal.test(text)).length;
  return knownFieldCount >= 4 && weakCount >= 2;
}
