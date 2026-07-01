/**
 * Structured-output schema + prompt for turning resume text into a Profile.
 * No pdf.js import here so the background service worker stays lean. The schema
 * follows Anthropic structured-output limits: every object sets
 * additionalProperties:false and lists required keys; no string/number
 * constraints.
 */

export const RESUME_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    personal: {
      type: 'object',
      additionalProperties: false,
      properties: {
        firstName: { type: 'string' },
        middleName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        zip: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['firstName', 'middleName', 'lastName', 'email', 'phone', 'city', 'state', 'zip', 'country'],
    },
    links: {
      type: 'object',
      additionalProperties: false,
      properties: {
        linkedin: { type: 'string' },
        github: { type: 'string' },
        portfolio: { type: 'string' },
        website: { type: 'string' },
      },
      required: ['linkedin', 'github', 'portfolio', 'website'],
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          school: { type: 'string' },
          degree: { type: 'string' },
          field: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          gpa: { type: 'string' },
        },
        required: ['school', 'degree', 'field', 'startDate', 'endDate', 'gpa'],
      },
    },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          company: { type: 'string' },
          title: { type: 'string' },
          location: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['company', 'title', 'location', 'startDate', 'endDate', 'description'],
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['personal', 'links', 'education', 'experience', 'skills', 'summary'],
};

export const RESUME_SYSTEM = `You extract structured data from a resume. Return only fields you can find in the text. Use empty strings for anything missing — never invent data. Normalize phone to digits with separators as written, and keep URLs as full https links. For the summary, write a concise 2-3 sentence professional summary based on the resume.`;

export function buildResumeUserPrompt(resumeText: string): string {
  return `Here is the resume text. Extract the structured profile.\n\n---\n${resumeText}\n---`;
}
