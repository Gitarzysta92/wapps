import { Injectable } from '@nestjs/common';
import {
  reviewChange,
  reviewCursor,
  reviewId,
  reviewObject,
  reviewReportPage,
  reviewRevision,
  reviewSummary,
  type ReviewChange,
} from '@sdk/features/review/core';
import {
  applicationReviewFromBinding,
  applicationReviewPageFromBinding,
} from '@domains/community';
import type {
  TrustedPortalIdentity,
  TrustedPortalViewer,
} from '../identity/trusted-portal-identity';
import { reviewRequest, reviewResult } from './portal-reviews.request';
import { PortalReviewsTransport } from './portal-reviews.transport';
import { reviewOwnerPath } from './review-owner-path';

@Injectable()
export class PortalReviewsClient {
  constructor(private readonly transport: PortalReviewsTransport) {}
  async summary(actor: TrustedPortalViewer, applicationId: string) {
    const raw = await this.transport.send(
      actor,
      reviewOwnerPath(applicationId, '/summary')
    );
    return reviewResult(() => reviewSummary(raw));
  }
  async page(
    actor: TrustedPortalViewer,
    applicationId: string,
    cursor: unknown,
    moderation = false
  ) {
    const query = this.cursor(cursor);
    const raw = await this.transport.send(
      actor,
      reviewOwnerPath(applicationId, moderation ? '/moderation' : '', query)
    );
    return reviewResult(() =>
      applicationReviewPageFromBinding(raw, applicationId, moderation)
    );
  }
  async read(actor: TrustedPortalViewer, applicationId: string, id: string) {
    const raw = await this.transport.send(
      actor,
      reviewOwnerPath(applicationId, `/${id}`)
    );
    return reviewResult(() => {
      const result = applicationReviewFromBinding(raw, applicationId);
      if (result.id !== id) throw new Error('Unexpected review');
      return result;
    });
  }
  async reports(
    actor: TrustedPortalIdentity,
    applicationId: string,
    id: string,
    cursor: unknown
  ) {
    const query = this.cursor(cursor);
    const raw = await this.transport.send(
      actor,
      reviewOwnerPath(applicationId, `/${id}/reports`, query)
    );
    return reviewResult(() => reviewReportPage(raw));
  }
  async change(
    actor: TrustedPortalIdentity,
    applicationId: string,
    id: string | null,
    type: ReviewChange['type'],
    input: unknown,
    key: string
  ) {
    const change = reviewRequest(() => reviewChange(type, input));
    const body = {
      expectedRevision: change.expectedRevision,
      ...('content' in change ? { content: change.content } : {}),
      ...('helpful' in change ? { helpful: change.helpful } : {}),
      ...('reason' in change ? { reason: change.reason } : {}),
      ...('hidden' in change ? { hidden: change.hidden } : {}),
    };
    const suffix =
      type === 'helpful'
        ? '/helpful'
        : type === 'report'
        ? '/reports'
        : type === 'moderate'
        ? '/moderation'
        : '';
    const raw = await this.transport.send(
      actor,
      reviewOwnerPath(applicationId, `/${id ?? 'mine'}${suffix}`),
      {
        method:
          type === 'report' ? 'POST' : type === 'withdraw' ? 'DELETE' : 'PUT',
        body,
        key,
      }
    );
    return reviewResult(() => {
      const row = reviewObject(raw, ['id', 'revision']);
      const result = {
        id: reviewId(row.id),
        revision: reviewRevision(row.revision),
      };
      if (
        (id !== null && result.id !== id) ||
        result.revision !== change.expectedRevision + 1
      )
        throw new Error('Unexpected review receipt');
      return result;
    });
  }
  private cursor(input: unknown) {
    return reviewRequest(() => {
      if (input === undefined) return undefined;
      reviewCursor(input);
      if (typeof input !== 'string') throw new Error('Invalid cursor');
      return input;
    });
  }
}
