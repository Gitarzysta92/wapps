import type { Provider } from '@angular/core';
import { REVIEWS, REVIEWS_ORIGIN } from './application/reviews.port';
import { ReviewsService } from './application/reviews.service';
import { ReviewsApiService } from './infrastructure/reviews-api.service';

export function provideReviews(apiOrigin: string): Provider[] {
  if (typeof apiOrigin !== 'string')
    throw new Error('An explicit review API origin is required');
  if (apiOrigin) {
    const origin = new URL(apiOrigin);
    if (
      !['http:', 'https:'].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash
    )
      throw new Error('Invalid review API origin');
  }
  return [
    ReviewsService,
    { provide: REVIEWS_ORIGIN, useValue: apiOrigin.replace(/\/$/, '') },
    { provide: REVIEWS, useClass: ReviewsApiService },
  ];
}
