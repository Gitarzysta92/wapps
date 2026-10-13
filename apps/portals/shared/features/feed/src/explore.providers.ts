import type { Provider } from '@angular/core';
import {
  EXPLORE_LINK,
  EXPLORE_PORT,
  EXPLORE_URL,
} from './application/explore.port';
import type { ExploreTarget } from '@domains/feed';
import { ExploreApiService } from './infrastructure/explore-api.service';

/** API composition requires the host's preferences, favorites and authentication providers. */
export function provideExplore(
  origin: string,
  link: (target: ExploreTarget) => {
    path: string | string[];
    query?: Record<string, string>;
  }
): Provider[] {
  if (origin) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid Explore API origin');
  }
  return [
    { provide: EXPLORE_URL, useValue: origin.replace(/\/$/, '') },
    { provide: EXPLORE_LINK, useValue: link },
    { provide: EXPLORE_PORT, useClass: ExploreApiService },
  ];
}
