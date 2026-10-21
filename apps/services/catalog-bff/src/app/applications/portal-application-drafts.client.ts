import { Injectable } from '@nestjs/common';
import {
  applicationDraftId,
  applicationDraftObject,
  applicationDraftRevision,
  parseApplicationDraft,
  parseApplicationDraftFields,
  parseApplicationDraftList,
  parseApplicationDraftReceipt,
  parseApplicationEditingSource,
  parseApplicationEditingTarget,
} from '@domains/catalog/record';
import {
  parseApplicationImageChange,
  parseApplicationImageMerge,
} from '@domains/catalog/media';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';
import {
  applicationRequest,
  applicationResult,
} from './portal-application.request';
import { PortalApplicationTransport } from './portal-application.transport';

export type DraftAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'open'
  | 'rebase'
  | 'images';
const base = '/api/me/application-drafts';

@Injectable()
export class PortalApplicationDraftsClient {
  constructor(private readonly transport: PortalApplicationTransport) {}
  async list(actor: TrustedPortalIdentity) {
    const raw = await this.transport.send(actor, base);
    return applicationResult(() => parseApplicationDraftList(raw));
  }
  async read(actor: TrustedPortalIdentity, id: string) {
    const raw = await this.transport.send(actor, `${base}/${id}`);
    return applicationResult(() => {
      const draft = parseApplicationDraft(raw);
      if (draft.id !== id) throw new Error('Unexpected draft');
      return draft;
    });
  }
  async source(actor: TrustedPortalIdentity, id: string) {
    const raw = await this.transport.send(actor, `${base}/canonical/${id}`);
    return applicationResult(() => {
      const source = parseApplicationEditingSource(raw);
      if (source.applicationId !== id)
        throw new Error('Unexpected canonical application');
      return source;
    });
  }
  async change(
    actor: TrustedPortalIdentity,
    action: DraftAction,
    id: string | null,
    input: unknown,
    key: string
  ) {
    const command = applicationRequest(() => {
      const target =
        action === 'create' || action === 'open'
          ? null
          : applicationDraftId(id);
      if (action === 'images') {
        const body = parseApplicationImageChange(input);
        return { target, body, revision: body.expectedRevision };
      }
      if (action === 'open' || action === 'rebase') {
        const value = applicationDraftObject(
          input,
          action === 'open'
            ? ['editing', 'fields']
            : ['editing', 'fields', 'expectedRevision', 'imageChoices']
        );
        const revision =
          action === 'open'
            ? 0
            : applicationDraftRevision(value.expectedRevision);
        return {
          target,
          revision,
          body: {
            editing: parseApplicationEditingTarget(value.editing),
            fields: parseApplicationDraftFields(value.fields),
            ...(action === 'open' ? {} : { expectedRevision: revision }),
            ...(value.imageChoices === undefined
              ? {}
              : {
                  imageChoices: parseApplicationImageMerge(value.imageChoices),
                }),
          },
        };
      }
      const keys = ['name', 'slug', 'website', 'description', 'classification'];
      const value = applicationDraftObject(
        input,
        action === 'delete'
          ? ['expectedRevision']
          : action === 'create'
          ? keys
          : [...keys, 'expectedRevision']
      );
      const revision =
        action === 'create'
          ? 0
          : applicationDraftRevision(value.expectedRevision);
      const fields =
        action === 'delete'
          ? {}
          : parseApplicationDraftFields(
              Object.fromEntries(keys.map((key) => [key, value[key]]))
            );
      return {
        target,
        revision,
        body: {
          ...fields,
          ...(action === 'create' ? {} : { expectedRevision: revision }),
        },
      };
    });
    const method =
      action === 'delete'
        ? 'DELETE'
        : action === 'update' || action === 'images'
        ? 'PUT'
        : 'POST';
    const path =
      action === 'open'
        ? (`${base}/from-application` as const)
        : action === 'create'
        ? base
        : (`${base}/${command.target}${
            action === 'rebase' || action === 'images' ? '/' + action : ''
          }` as const);
    const raw = await this.transport.send(actor, path, {
      method,
      body: command.body,
      key,
    });
    return applicationResult(() => {
      const receipt = parseApplicationDraftReceipt(raw);
      if (
        (command.target !== null && receipt.id !== command.target) ||
        receipt.revision !== command.revision + 1 ||
        receipt.deleted !== (action === 'delete')
      )
        throw new Error('Unexpected draft receipt');
      return receipt;
    });
  }
}
