import type { AtsAdapter } from '@/lib/fields/types';
import { genericAdapter } from './generic';
import { greenhouseAdapter } from './greenhouse';
import { leverAdapter } from './lever';
import { workdayAdapter } from './workday';

/**
 * Ordered list of specific adapters. The first whose `matches()` returns true
 * wins; otherwise we fall back to the generic heuristic adapter. Specific
 * adapters are registered here as they are implemented (greenhouse, lever,
 * workday).
 */
const specificAdapters: AtsAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  workdayAdapter,
];

export function pickAdapter(url: URL, doc: Document): AtsAdapter {
  for (const adapter of specificAdapters) {
    try {
      if (adapter.matches(url, doc)) return adapter;
    } catch {
      // ignore a misbehaving matcher
    }
  }
  return genericAdapter;
}
