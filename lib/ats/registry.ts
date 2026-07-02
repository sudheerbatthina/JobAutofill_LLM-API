import type { AtsAdapter } from '@/lib/fields/types';
import { genericAdapter } from './generic';
import { greenhouseAdapter } from './greenhouse';
import { leverAdapter } from './lever';
import { workdayAdapter } from './workday';
import { ashbyAdapter } from './ashby';
import { workableAdapter } from './workable';
import { icimsAdapter } from './icims';
import { smartRecruitersAdapter } from './smartrecruiters';
import { bambooHrAdapter } from './bamboohr';

/**
 * Ordered list of specific adapters. The first whose `matches()` returns true
 * wins; otherwise we fall back to the generic heuristic adapter. Specific
 * adapters are registered here as they are implemented. Adapters recognising
 * a real ATS platform (rather than deferring purely to the generic pipeline)
 * matter beyond fill behaviour: `Controller.looksLikeApplication()` skips its
 * heuristic page-gate entirely whenever `adapter.name !== 'generic'`, so
 * registering a platform here also means "always show icons on this site."
 */
const specificAdapters: AtsAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  workdayAdapter,
  ashbyAdapter,
  workableAdapter,
  icimsAdapter,
  smartRecruitersAdapter,
  bambooHrAdapter,
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
