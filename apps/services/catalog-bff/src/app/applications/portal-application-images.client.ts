import { Injectable } from '@nestjs/common';
import {
  APPLICATION_IMAGE_RETAINED_LIMIT,
  parseApplicationImageUpload,
  parseApplicationImageUploadInput,
  parseApplicationImageUploadReceipt,
  applicationImageInteger,
  applicationImageObject,
  type ApplicationImagePurpose,
} from '@domains/catalog/media';
import type {
  TrustedPortalIdentity,
  TrustedPortalViewer,
} from '../identity/trusted-portal-identity';
import {
  applicationRequest,
  applicationResult,
} from './portal-application.request';
import { PortalApplicationTransport } from './portal-application.transport';

const base = '/api/me/application-images';
export type ApplicationImagePreview =
  | { kind: 'upload'; id: string }
  | {
      kind: 'draft' | 'canonical';
      id: string;
      purpose: ApplicationImagePurpose;
    }
  | {
      kind: 'submission';
      id: string;
      purpose: ApplicationImagePurpose;
      revision: number;
      review: boolean;
    }
  | {
      kind: 'published';
      id: string;
      purpose: ApplicationImagePurpose;
      imageId: string;
    };

@Injectable()
export class PortalApplicationImagesClient {
  constructor(private readonly transport: PortalApplicationTransport) {}
  async list(actor: TrustedPortalIdentity, draftId: string) {
    const raw = await this.transport.send(actor, `${base}?draftId=${draftId}`);
    return applicationResult(() => {
      if (!Array.isArray(raw) || raw.length > APPLICATION_IMAGE_RETAINED_LIMIT)
        throw new Error('Invalid upload list');
      const uploads = raw.map(parseApplicationImageUpload);
      if (
        uploads.some(
          (upload) =>
            upload.draftId !== draftId || upload.status === 'cancelled'
        ) ||
        new Set(uploads.map((upload) => upload.id)).size !== uploads.length
      )
        throw new Error('Unexpected uploads');
      return uploads;
    });
  }
  async read(actor: TrustedPortalIdentity, id: string, signal?: AbortSignal) {
    const raw = await this.transport.send(actor, `${base}/${id}`, { signal });
    return applicationResult(() => {
      const upload = parseApplicationImageUpload(raw);
      if (upload.id !== id) throw new Error('Unexpected upload');
      return upload;
    });
  }
  async create(actor: TrustedPortalIdentity, input: unknown, key: string) {
    const body = applicationRequest(() =>
      parseApplicationImageUploadInput(input)
    );
    const raw = await this.transport.send(actor, base, {
      method: 'POST',
      body,
      key,
    });
    return this.receipt(raw, null, 1, 'pending');
  }
  async cancel(
    actor: TrustedPortalIdentity,
    id: string,
    input: unknown,
    key: string
  ) {
    const body = applicationRequest(() => ({
      expectedRevision: applicationImageInteger(
        applicationImageObject(input, ['expectedRevision']).expectedRevision
      ),
    }));
    const raw = await this.transport.send(actor, `${base}/${id}`, {
      method: 'DELETE',
      body,
      key,
    });
    return this.receipt(raw, id, body.expectedRevision + 1, 'cancelled');
  }
  async upload(
    actor: TrustedPortalIdentity,
    id: string,
    revision: number,
    bytes: Buffer,
    key: string,
    signal: AbortSignal
  ) {
    const raw = await this.transport.send(actor, `${base}/${id}/content`, {
      method: 'PUT',
      body: bytes,
      revision,
      key,
      signal,
    });
    return this.receipt(raw, id, revision + 1, 'ready');
  }
  async preview(
    actor: TrustedPortalViewer,
    target: ApplicationImagePreview,
    signal: AbortSignal
  ) {
    const { id } = target;
    const path =
      target.kind === 'upload'
        ? (`${base}/${id}/content` as const)
        : target.kind === 'published'
        ? (`/api/media/applications/${id}/${target.purpose}/${target.imageId}` as const)
        : target.kind === 'submission'
        ? (`${
            target.review
              ? '/api/editorial/application-reviews'
              : '/api/me/application-drafts'
          }/${id}/submissions/${target.revision}/images/${
            target.purpose
          }/content` as const)
        : (`/api/me/application-drafts/${
            target.kind === 'canonical' ? 'canonical/' : ''
          }${id}/images/${target.purpose}/content` as const);
    const bytes = await this.transport.send(actor, path, {
      binary: true,
      signal,
    });
    return applicationResult(() => {
      if (!Buffer.isBuffer(bytes)) throw new Error('Invalid image bytes');
      return bytes;
    });
  }
  private receipt(
    raw: unknown,
    id: string | null,
    revision: number,
    status: 'pending' | 'ready' | 'cancelled'
  ) {
    return applicationResult(() => {
      const receipt = parseApplicationImageUploadReceipt(raw);
      if (
        (id !== null && receipt.id !== id) ||
        receipt.revision !== revision ||
        receipt.status !== status
      )
        throw new Error('Unexpected upload receipt');
      return receipt;
    });
  }
}
