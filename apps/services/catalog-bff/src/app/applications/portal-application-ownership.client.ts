import { Injectable } from '@nestjs/common';
import {
  parseOwnershipClaim,
  parseOwnershipPage,
  parseOwnershipReceipt,
  type OwnershipAction,
  type OwnershipChangeInput,
  type OwnershipClaimInput,
} from '@domains/catalog/ownership';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';
import { applicationResult } from './portal-application.request';
import { PortalApplicationTransport } from './portal-application.transport';

const claims = '/api/me/ownership-claims';
const reviews = '/api/editorial/ownership-reviews';

@Injectable()
export class PortalApplicationOwnershipClient {
  constructor(private readonly transport: PortalApplicationTransport) {}

  async list(
    actor: TrustedPortalIdentity,
    review: boolean,
    page: number,
    grants: boolean
  ) {
    const raw = await this.transport.send(
      actor,
      review
        ? `${reviews}?page=${page}&view=${grants ? 'grants' : 'pending'}`
        : `${claims}?page=${page}`
    );
    return applicationResult(() => {
      const result = parseOwnershipPage(raw);
      if (
        result.page !== page ||
        result.items.length > Math.max(0, result.total - (page - 1) * 20) ||
        result.items.some(
          (claim) =>
            (claim.claimantIdentityId === actor.identityId) === review ||
            (review &&
              claim.status !== (grants ? 'approved' : 'awaiting-review'))
        )
      )
        throw new Error('Unexpected ownership page');
      return result;
    });
  }

  async read(actor: TrustedPortalIdentity, id: string, review: boolean) {
    const raw = await this.transport.send(
      actor,
      review ? `${reviews}/${id}` : `${claims}/${id}`
    );
    return applicationResult(() => {
      const claim = parseOwnershipClaim(raw);
      if (
        claim.id !== id ||
        (claim.claimantIdentityId === actor.identityId) === review
      )
        throw new Error('Unexpected ownership claim');
      return claim;
    });
  }

  async create(
    actor: TrustedPortalIdentity,
    input: OwnershipClaimInput,
    key: string
  ) {
    const raw = await this.transport.send(actor, claims, {
      method: 'POST',
      body: input,
      key,
    });
    return applicationResult(() => {
      const receipt = parseOwnershipReceipt(raw);
      if (receipt.action !== 'create')
        throw new Error('Unexpected ownership creation receipt');
      return receipt;
    });
  }

  async change(
    actor: TrustedPortalIdentity,
    id: string,
    action: Exclude<OwnershipAction, 'create'>,
    input: OwnershipChangeInput,
    key: string
  ) {
    const review = ['approve', 'reject', 'revoke'].includes(action);
    const raw = await this.transport.send(
      actor,
      review ? `${reviews}/${id}/decision` : `${claims}/${id}/${action}`,
      {
        method: 'POST',
        key,
        body: review
          ? { ...input, decision: action }
          : action === 'release'
          ? input
          : { expectedRevision: input.expectedRevision },
      }
    );
    return applicationResult(() => {
      const receipt = parseOwnershipReceipt(raw);
      if (
        receipt.id !== id ||
        receipt.action !== action ||
        receipt.revision !== input.expectedRevision + 1
      )
        throw new Error('Unexpected ownership receipt');
      return receipt;
    });
  }
}
