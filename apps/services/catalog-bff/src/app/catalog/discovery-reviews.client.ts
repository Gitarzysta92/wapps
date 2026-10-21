import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { reviewId } from '@sdk/features/review/core';
import { applicationReviewPageFromBinding } from '@domains/community';
import { reviewOwnerPath } from '../reviews/review-owner-path';
import { DiscoveryUnavailableError } from '@domains/discovery';
import type { DiscoveryReviewReader } from './discovery.service';

@Injectable()
export class DiscoveryReviewsClient implements DiscoveryReviewReader {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}
  async read(id: string) {
    const origin = this.config.get<string>('DISCUSSION_URL');
    if (!origin)
      throw new DiscoveryUnavailableError('Reviews are unconfigured');
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new DiscoveryUnavailableError('Invalid reviews origin');
    // Anonymous public reads exclude hidden/withdrawn reviews and expose no account identity.
    const response = await firstValueFrom(
      this.http.get<unknown>(url.origin + reviewOwnerPath(reviewId(id)), {
        timeout: 5000,
        maxRedirects: 0,
        maxContentLength: 128 * 1024,
        headers: { Accept: 'application/json' },
      })
    );
    const page = applicationReviewPageFromBinding(response.data, id),
      review = page.items[0];
    return {
      total: page.summary.total,
      rating: page.summary.average,
      preview: review
        ? {
            id: review.id,
            byline: review.content.displayName,
            rating: review.content.rating,
            text: review.content.text.slice(0, 1000),
            publishedAt: review.createdAt,
          }
        : null,
    };
  }
}
