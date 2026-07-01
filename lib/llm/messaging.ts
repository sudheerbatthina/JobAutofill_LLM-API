import type { Profile } from '@/lib/profile/schema';

/**
 * Runtime message contract between UI/content contexts and the background
 * service worker. All Claude (network) calls go through the worker so the API
 * key stays out of content scripts and CORS is handled in one place.
 */

export interface GenerateEssayRequest {
  type: 'CLAUDE_GENERATE_ESSAY';
  question: string;
  /** Extra context, e.g. the job description text scraped from the page. */
  jobContext?: string;
}

export interface StructureResumeRequest {
  type: 'CLAUDE_STRUCTURE_RESUME';
  /** Plain text extracted from the resume PDF (via pdf.js in the page). */
  resumeText: string;
}

export type BackgroundRequest = GenerateEssayRequest | StructureResumeRequest;

export interface GenerateEssayResponse {
  ok: boolean;
  text: string;
  error?: string;
}

export interface StructureResumeResponse {
  ok: boolean;
  profile?: Partial<Profile>;
  error?: string;
}
