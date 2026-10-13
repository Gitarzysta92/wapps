import { createHash } from 'node:crypto';
import {
  parseApplicationImageChange,
  parseApplicationImageMerge,
  type ApplicationImageChange,
  type ApplicationImageMerge,
} from '@domains/catalog/media';
import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  applicationDraftId,
  applicationDraftObject,
  applicationDraftRevision,
  parseApplicationDraftFields,
  parseApplicationEditingTarget,
  ApplicationDraftInputError,
  ApplicationDraftUnavailableError,
  type ApplicationDraft,
  type ApplicationDraftFields,
  type ApplicationDraftReceipt,
  type ApplicationEditingTarget,
  type ApplicationEditingSource,
} from '@domains/catalog/record';
import { assertEditorialActor } from '../application/editorial-commands';
import type { EditorialActor } from '../application/editorial.ports';

export interface ApplicationDraftCommand {
  actor: EditorialActor;
  type: 'create' | 'update' | 'delete' | 'open' | 'rebase' | 'images';
  id: string;
  expectedRevision: number | null;
  fields: ApplicationDraftFields | null;
  key: string;
  fingerprint: string;
  at: number;
  editing?: ApplicationEditingTarget;
  imageChange?: ApplicationImageChange;
  imageChoices?: ApplicationImageMerge;
}
export interface ApplicationDraftStore {
  list(actor: EditorialActor): Promise<ApplicationDraft[]>;
  read(actor: EditorialActor, id: string): Promise<ApplicationDraft>;
  editingSource(
    actor: EditorialActor,
    applicationId: string
  ): Promise<ApplicationEditingSource>;
  commit(command: ApplicationDraftCommand): Promise<ApplicationDraftReceipt>;
}
export class ApplicationDrafts {
  constructor(
    private readonly store: ApplicationDraftStore,
    private readonly policy: IPolicyEvaluator,
    private readonly ids: { generate(): string },
    private readonly now: () => number = Date.now
  ) {}
  async list(actor: EditorialActor) {
    await this.authorize(actor, 'read');
    return this.store.list(actor);
  }
  async read(actor: EditorialActor, id: string) {
    await this.authorize(actor, 'read');
    return this.store.read(actor, applicationDraftId(id));
  }
  async change(
    actor: EditorialActor,
    type: 'create' | 'update' | 'delete',
    id: string | null,
    input: unknown,
    key: string
  ) {
    await this.authorize(actor, type);
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new ApplicationDraftInputError(
        'A valid Idempotency-Key is required'
      );
    const data = applicationDraftObject(
      input,
      type === 'delete'
        ? ['expectedRevision']
        : [
            'name',
            'slug',
            'website',
            'description',
            'classification',
            ...(type === 'update' ? ['expectedRevision'] : []),
          ]
    );
    const expectedRevision =
      type === 'create'
        ? null
        : applicationDraftRevision(data['expectedRevision']);
    const fields =
      type === 'delete'
        ? null
        : parseApplicationDraftFields({
            name: data['name'],
            slug: data['slug'],
            website: data['website'],
            description: data['description'],
            classification: data['classification'],
          });
    const target = type === 'create' ? null : applicationDraftId(id);
    return this.store.commit({
      actor,
      type,
      id: target ?? applicationDraftId(this.ids.generate()),
      expectedRevision,
      fields,
      key,
      at: this.now(),
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ type, id: target, expectedRevision, fields }))
        .digest('hex'),
    });
  }
  async source(actor: EditorialActor, applicationId: string) {
    await this.authorize(actor, 'read');
    return this.store.editingSource(actor, applicationDraftId(applicationId));
  }
  async changeImages(
    actor: EditorialActor,
    id: string,
    input: unknown,
    key: string
  ) {
    await this.authorize(actor, 'update');
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new ApplicationDraftInputError(
        'A valid Idempotency-Key is required'
      );
    const target = applicationDraftId(id);
    const imageChange = parseApplicationImageChange(input);
    return this.store.commit({
      actor,
      id: target,
      type: 'images',
      fields: null,
      expectedRevision: imageChange.expectedRevision,
      imageChange,
      key,
      at: this.now(),
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ type: 'images', id: target, imageChange }))
        .digest('hex'),
    });
  }
  async editExisting(
    actor: EditorialActor,
    type: 'open' | 'rebase',
    id: string | null,
    input: unknown,
    key: string
  ) {
    await this.authorize(actor, type === 'open' ? 'create' : 'update');
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new ApplicationDraftInputError(
        'A valid Idempotency-Key is required'
      );
    const data = applicationDraftObject(input, [
      'editing',
      'fields',
      ...(type === 'rebase' ? ['imageChoices'] : []),
      ...(type === 'rebase' ? ['expectedRevision'] : []),
    ]);
    const editing = parseApplicationEditingTarget(data['editing']);
    const fields = parseApplicationDraftFields(data['fields']);
    const imageChoices =
      data['imageChoices'] === undefined
        ? undefined
        : parseApplicationImageMerge(data['imageChoices']);
    const expectedRevision =
      type === 'open'
        ? null
        : applicationDraftRevision(data['expectedRevision']);
    const target = type === 'open' ? null : applicationDraftId(id);
    return this.store.commit({
      actor,
      type,
      id: target ?? applicationDraftId(this.ids.generate()),
      editing,
      ...(imageChoices ? { imageChoices } : {}),
      fields,
      expectedRevision,
      key,
      at: this.now(),
      fingerprint: createHash('sha256')
        .update(
          JSON.stringify({
            type,
            id: target,
            editing,
            fields,
            expectedRevision,
            ...(imageChoices ? { imageChoices } : {}),
          })
        )
        .digest('hex'),
    });
  }
  private async authorize(
    actor: EditorialActor,
    operation: 'read' | 'create' | 'update' | 'delete'
  ) {
    assertEditorialActor(actor);
    const actionName = `editorial.application-draft.${operation}`;
    let result;
    try {
      result = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        timestamp: this.now(),
        actionName,
        subject: { roles: actor.roles },
        resource: {
          type: 'application-workspace',
          id: actor.identityId,
          tenantId: actor.tenantId,
        },
      });
    } catch {
      throw new ApplicationDraftUnavailableError(
        'Application workspace authorization unavailable'
      );
    }
    if (!result.ok)
      throw new ApplicationDraftUnavailableError(
        'Application workspace authorization unavailable'
      );
    if (result.value !== true) throw new PermissionDeniedError(actionName);
  }
}
