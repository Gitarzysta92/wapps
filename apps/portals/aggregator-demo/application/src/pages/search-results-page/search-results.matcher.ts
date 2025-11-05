// search-results.matcher.ts
import { UrlSegment, UrlMatchResult } from '@angular/router';
import { NAVIGATION } from '../../navigation';


export function searchResultsMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  // Require base path
  if (segments.length === 0 || segments[0].path !== NAVIGATION.search.path) return null;

  // /search
  if (segments.length === 1) {
    return { consumed: segments, posParams: {} };
  }

  // /search/page/:page
  if (segments.length === 3 && segments[1].path === 'page') {
    return {
      consumed: segments,
      posParams: { page: segments[2] }
    };
  }

  return null;
}

