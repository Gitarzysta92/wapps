import type { Provider } from '@angular/core';
import {
  APPLICATION_DISCUSSIONS,
  APPLICATION_DISCUSSION_ORIGIN,
} from './application/application-discussions.port';
import { ApplicationDiscussionsApiService } from './infrastructure/application-discussions-api.service';
import { ApplicationDiscussionsService } from './application/application-discussions.service';

export function provideApplicationDiscussions(apiBaseUrl: string): Provider[] {
  return [
    ApplicationDiscussionsService,
    ...provideQuickDiscussions(apiBaseUrl),
  ];
}

/**
 * Each page or dialog owns its state. The host also supplies its session and
 * provideMentionMembers('api', accountOrigin) for the shared composer.
 */
export function provideQuickDiscussions(apiBaseUrl: string): Provider[] {
  if (typeof apiBaseUrl !== 'string')
    throw new Error('An explicit discussion API origin is required');
  if (apiBaseUrl) {
    const origin = new URL(apiBaseUrl);
    if (
      !['http:', 'https:'].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== '/'
    )
      throw new Error('Invalid discussion API origin');
  }
  return [
    {
      provide: APPLICATION_DISCUSSION_ORIGIN,
      useValue: apiBaseUrl.replace(/\/$/, ''),
    },
    {
      provide: APPLICATION_DISCUSSIONS,
      useClass: ApplicationDiscussionsApiService,
    },
  ];
}
