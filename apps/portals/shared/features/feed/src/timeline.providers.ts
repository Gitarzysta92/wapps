import type { Provider } from '@angular/core';
import { TIMELINE_PORT, TIMELINE_URL } from './application/timeline.port';
import { TimelineApiService } from './infrastructure/timeline-api.service';

export function provideApplicationTimeline(origin: string): Provider[] {
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
      throw new Error('Invalid timeline API origin');
  }
  return [
    { provide: TIMELINE_URL, useValue: origin.replace(/\/$/, '') },
    { provide: TIMELINE_PORT, useClass: TimelineApiService },
  ];
}
