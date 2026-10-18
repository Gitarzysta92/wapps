import { Injectable } from '@nestjs/common';
import {
  parseApplicationPublicationReceipt,
  parseApplicationPublicationStatus,
  parseApplicationReviewPage,
  type ApplicationPublicationAction,
  type ApplicationPublicationInput,
} from '@domains/catalog/record';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';
import { applicationResult } from './portal-application.request';
import { PortalApplicationTransport } from './portal-application.transport';

const drafts = '/api/me/application-drafts';
const reviews = '/api/editorial/application-reviews';

@Injectable()
export class PortalApplicationPublicationClient {
  constructor(private readonly transport: PortalApplicationTransport) {}

  async status(actor: TrustedPortalIdentity, id: string, review: boolean) {
    const raw = await this.transport.send(
      actor,
      review ? `${reviews}/${id}` : `${drafts}/${id}/publication`
    );
    return applicationResult(() => {
      const result = parseApplicationPublicationStatus(raw);
      if (result.id !== id)
        throw new Error('Unexpected application publication');
      return result;
    });
  }

  async reviews(actor: TrustedPortalIdentity, page: number) {
    const raw = await this.transport.send(actor, `${reviews}?page=${page}`);
    return applicationResult(() => {
      const result = parseApplicationReviewPage(raw);
      if (
        result.page !== page ||
        result.items.length > Math.max(0, result.total - (page - 1) * 20)
      )
        throw new Error('Unexpected application review page');
      return result;
    });
  }

  async change(
    actor: TrustedPortalIdentity,
    id: string,
    action: ApplicationPublicationAction,
    input: ApplicationPublicationInput,
    key: string
  ) {
    const review = action === 'approve' || action === 'reject';
    const raw = await this.transport.send(
      actor,
      review ? `${reviews}/${id}/decision` : `${drafts}/${id}/${action}`,
      {
        method: 'POST',
        key,
        body: review
          ? {
              decision: action,
              expectedRevision: input.expectedRevision,
              submittedRevision: input.submittedRevision,
              reason: input.reason,
            }
          : { expectedRevision: input.expectedRevision },
      }
    );
    return applicationResult(() => {
      const receipt = parseApplicationPublicationReceipt(raw);
      if (
        receipt.id !== id ||
        receipt.action !== action ||
        receipt.revision !== input.expectedRevision + 1 ||
        (review && receipt.submittedRevision !== input.submittedRevision) ||
        (action === 'submit' &&
          receipt.submittedRevision !== input.expectedRevision)
      )
        throw new Error('Unexpected application publication receipt');
      return receipt;
    });
  }
}
