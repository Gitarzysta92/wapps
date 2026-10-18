import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { ExplorePage, ExploreTarget } from '@domains/feed';

export interface ExplorePort {
  read(after: string | null): Observable<Result<ExplorePage, Error>>;
}
export const EXPLORE_PORT = new InjectionToken<ExplorePort>('EXPLORE_PORT');
export const EXPLORE_URL = new InjectionToken<string>('EXPLORE_URL');
export type ExploreLinkTarget =
  | ExploreTarget
  | { kind: 'application-reviews'; applicationSlug: string };
export const EXPLORE_LINK = new InjectionToken<
  (target: ExploreLinkTarget) => {
    path: string | string[];
    query?: Record<string, string>;
  }
>('EXPLORE_LINK');
