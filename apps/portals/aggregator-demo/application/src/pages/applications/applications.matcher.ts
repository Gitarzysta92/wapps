// applications.matcher.ts
import { UrlSegment, UrlMatchResult } from '@angular/router';
import { NAVIGATION } from '../../navigation';
import { FILTERS } from '../../filters';


export function applicationsMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  // Require base path
  if (segments.length === 0 || segments[0].path !== NAVIGATION.applications.path) return null;

  // /applications
  if (segments.length === 1) {
    return { consumed: segments, posParams: {} };
  }

  // /applications/page/:page
  if (segments.length === 3 && segments[1].path === 'page') {
    return {
      consumed: segments,
      posParams: { page: segments[2] }
    };
  }

  // /applications/:category/page/:page
  if (segments.length === 4 && segments[2].path === 'page') {
    // If you want the param name to come from FILTERS.category:
    return {
      consumed: segments,
      posParams: {
        // dynamic key, same as your `:category` name
        [FILTERS.category]: segments[1],
        page: segments[3]
      } as any
    };
  }

  return null;
}
