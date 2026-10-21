import type { Provider } from '@angular/core';
import {
  MY_DISCUSSIONS,
  MY_DISCUSSIONS_ORIGIN,
} from './application/my-discussions.port';
import { MyDiscussionsService } from './application/my-discussions.service';
import { MyDiscussionsApiService } from './infrastructure/my-discussions-api.service';

export function provideMyDiscussions(apiBaseUrl: string): Provider[] {
  if (typeof apiBaseUrl !== 'string')
    throw new Error('An explicit discussion API origin is required');
  if (apiBaseUrl) {
    const url = new URL(apiBaseUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid discussion API origin');
  }
  return [
    MyDiscussionsService,
    { provide: MY_DISCUSSIONS_ORIGIN, useValue: apiBaseUrl.replace(/\/$/, '') },
    { provide: MY_DISCUSSIONS, useClass: MyDiscussionsApiService },
  ];
}
