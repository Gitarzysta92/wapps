import { Injectable } from '@nestjs/common';
import {
  RELEASE_DRAFT_LIMIT,
  parseReleaseDraft,
  parseReleaseFields,
  parseReleaseReceipt,
  parseReleaseSource,
  parseReleasePublicationStatus,
  parseReleasePublicationReceipt,
  parseReleaseReviewPage,
  parsePublishedRelease,
  parseReleasePage,
  releaseId,
  releaseObject,
  releaseRevision,
  type ReleaseBrowseFilter,
  type ReleasePublicationAction,
  type ReleasePublicationInput,
} from '@domains/catalog/versioning';
import type {
  TrustedPortalIdentity,
  TrustedPortalViewer,
} from '../identity/trusted-portal-identity';
import { releaseRequest, releaseResult } from './portal-releases.request';
import { PortalReleasesTransport } from './portal-releases.transport';

export type ReleaseDraftAction =
  | 'create'
  | 'open'
  | 'update'
  | 'rebase'
  | 'delete';
const drafts = '/api/me/releases';
const reviews = '/api/editorial/release-reviews';
const catalog = '/api/catalog/releases';

@Injectable()
export class PortalReleasesClient {
  constructor(private readonly transport: PortalReleasesTransport) {}

  async list(actor: TrustedPortalIdentity) {
    const raw = await this.transport.send(actor, drafts);
    return releaseResult(() => {
      if (!Array.isArray(raw) || raw.length > RELEASE_DRAFT_LIMIT)
        throw new Error('Invalid release workspace');
      const items = raw.map(parseReleaseDraft);
      if (new Set(items.map((item) => item.id)).size !== items.length)
        throw new Error('Duplicate draft');
      return items;
    });
  }
  async read(actor: TrustedPortalIdentity, id: string) {
    const raw = await this.transport.send(actor, `${drafts}/${id}`);
    return releaseResult(() => {
      const result = parseReleaseDraft(raw);
      if (result.id !== id) throw new Error('Unexpected release draft');
      return result;
    });
  }
  async source(
    actor: TrustedPortalIdentity,
    applicationId: string,
    id: string | null
  ) {
    const raw = await this.transport.send(
      actor,
      `${drafts}/source/${applicationId}${
        id === null ? '' : '?releaseId=' + id
      }`
    );
    return releaseResult(() => {
      const result = parseReleaseSource(raw);
      if (
        result.applicationId !== applicationId ||
        (result.release?.id ?? null) !== id
      )
        throw new Error('Unexpected release source');
      return result;
    });
  }
  async draft(
    actor: TrustedPortalIdentity,
    action: ReleaseDraftAction,
    id: string | null,
    input: unknown,
    key: string
  ) {
    const command = releaseRequest(() => {
      const keys = {
        create: ['applicationId', 'claimId', 'fields'],
        open: [
          'applicationId',
          'claimId',
          'releaseId',
          'expectedPublicationRevision',
        ],
        update: ['expectedRevision', 'fields'],
        rebase: ['expectedRevision', 'expectedPublicationRevision', 'fields'],
        delete: ['expectedRevision'],
      };
      const value = releaseObject(input, keys[action]);
      const creating = action === 'create' || action === 'open';
      const revision = creating ? 0 : releaseRevision(value.expectedRevision);
      const target = creating ? null : releaseId(id);
      return {
        target,
        revision,
        body: {
          ...(creating
            ? {
                applicationId: releaseId(value.applicationId),
                claimId: releaseId(value.claimId),
              }
            : { expectedRevision: revision }),
          ...(action === 'open'
            ? { releaseId: releaseId(value.releaseId) }
            : {}),
          ...(action === 'open' || action === 'rebase'
            ? {
                expectedPublicationRevision:
                  action === 'rebase' &&
                  value.expectedPublicationRevision === null
                    ? null
                    : releaseRevision(value.expectedPublicationRevision),
              }
            : {}),
          ...(action === 'open' || action === 'delete'
            ? {}
            : { fields: parseReleaseFields(value.fields) }),
        },
      };
    });
    const path =
      action === 'create'
        ? drafts
        : action === 'open'
        ? (`${drafts}/open` as const)
        : action === 'rebase'
        ? (`${drafts}/${command.target}/rebase` as const)
        : (`${drafts}/${command.target}` as const);
    const raw = await this.transport.send(actor, path, {
      method:
        action === 'delete' ? 'DELETE' : action === 'update' ? 'PUT' : 'POST',
      key,
      body: command.body,
    });
    return releaseResult(() => {
      const result = parseReleaseReceipt(raw);
      if (
        (command.target !== null && result.id !== command.target) ||
        result.revision !== command.revision + 1 ||
        result.deleted !== (action === 'delete')
      )
        throw new Error('Unexpected release receipt');
      return result;
    });
  }
  async status(actor: TrustedPortalIdentity, id: string, review: boolean) {
    const raw = await this.transport.send(
      actor,
      review ? `${reviews}/${id}` : `${drafts}/${id}/publication`
    );
    return releaseResult(() => {
      const result = parseReleasePublicationStatus(raw);
      if (result.id !== id) throw new Error('Unexpected release publication');
      return result;
    });
  }
  async reviews(actor: TrustedPortalIdentity, page: number) {
    const raw = await this.transport.send(actor, `${reviews}?page=${page}`);
    return releaseResult(() => {
      const result = parseReleaseReviewPage(raw);
      if (result.page !== page) throw new Error('Unexpected review page');
      return result;
    });
  }
  async publish(
    actor: TrustedPortalIdentity,
    id: string,
    action: ReleasePublicationAction,
    input: ReleasePublicationInput,
    key: string
  ) {
    const review = action === 'approve' || action === 'reject';
    const raw = await this.transport.send(
      actor,
      review ? `${reviews}/${id}/decision` : `${drafts}/${id}/${action}`,
      {
        method: 'POST',
        key,
        body: {
          expectedRevision: input.expectedRevision,
          expectedPublicationRevision: input.expectedPublicationRevision,
          ...(review
            ? {
                decision: action,
                submittedRevision: input.submittedRevision,
                reason: input.reason,
              }
            : {}),
        },
      }
    );
    return releaseResult(() => {
      const result = parseReleasePublicationReceipt(raw);
      if (
        result.id !== id ||
        result.action !== action ||
        result.revision !== input.expectedRevision + 1 ||
        (review && result.submittedRevision !== input.submittedRevision)
      )
        throw new Error('Unexpected publication receipt');
      return result;
    });
  }
  async browse(
    actor: TrustedPortalViewer,
    slug: string,
    page: number,
    filter: ReleaseBrowseFilter
  ) {
    const query = new URLSearchParams({ page: String(page), ...filter });
    const raw = await this.transport.send(actor, `${catalog}/${slug}?${query}`);
    return releaseResult(() => {
      const result = parseReleasePage(raw);
      if (
        result.page !== page ||
        result.items.some(
          (item) =>
            item.applicationSlug !== slug ||
            (filter.channel !== undefined && item.channel !== filter.channel) ||
            (filter.before !== undefined && item.releasedOn >= filter.before)
        )
      )
        throw new Error('Unexpected release page');
      return result;
    });
  }
  async find(actor: TrustedPortalViewer, slug: string, version: string) {
    const raw = await this.transport.send(
      actor,
      `${catalog}/${slug}/${encodeURIComponent(version)}`
    );
    return releaseResult(() => {
      const result = parsePublishedRelease(raw);
      if (result.applicationSlug !== slug || result.version !== version)
        throw new Error('Unexpected public release');
      return result;
    });
  }
}
