import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { TimelinePage } from '@domains/feed';

export interface TimelinePort {
  read(
    slug: string,
    after: string | null
  ): Observable<Result<TimelinePage, Error>>;
}
export const TIMELINE_PORT = new InjectionToken<TimelinePort>('TIMELINE_PORT');
export const TIMELINE_URL = new InjectionToken<string>('TIMELINE_URL');
