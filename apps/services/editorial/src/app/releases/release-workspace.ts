import { createHash } from 'node:crypto';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  parseReleaseFields,
  parseReleasePublicationInput,
  releaseId,
  releaseObject,
  releaseRevision,
  releaseTimestamp,
  ReleaseInputError,
  ReleaseUnavailableError,
  type ReleaseDraft,
  type ReleaseFields,
  type ReleaseReceipt,
  type ReleaseSource,
  type ReleasePublicationAction,
  type ReleasePublicationInput,
  type ReleasePublicationReceipt,
  type ReleasePublicationStatus,
  type ReleaseReviewPage,
} from '@domains/catalog/versioning';
import { assertEditorialActor } from '../application/editorial-commands';
import type { EditorialActor } from '../application/editorial.ports';

export interface ReleaseDraftCommand {
  actor: EditorialActor;
  key: string;
  fingerprint: string;
  id: string;
  type: 'create' | 'open' | 'update' | 'rebase' | 'delete';
  fields: ReleaseFields | null;
  target: { applicationId: string; releaseId: string; claimId: string } | null;
  expectedRevision: number | null;
  expectedPublicationRevision: number | null;
  at: number;
}
export interface ReleasePublicationCommand {
  actor: EditorialActor;
  key: string;
  fingerprint: string;
  id: string;
  action: ReleasePublicationAction;
  input: ReleasePublicationInput;
  at: number;
}
export interface ReleaseWorkspaceStore {
  list(actor: EditorialActor): Promise<ReleaseDraft[]>;
  read(actor: EditorialActor, id: string): Promise<ReleaseDraft>;
  source(
    actor: EditorialActor,
    applicationId: string,
    releaseId: string | null
  ): Promise<ReleaseSource>;
  changeDraft(command: ReleaseDraftCommand): Promise<ReleaseReceipt>;
  status(
    actor: EditorialActor,
    id: string,
    review: boolean
  ): Promise<ReleasePublicationStatus>;
  reviews(actor: EditorialActor, page: number): Promise<ReleaseReviewPage>;
  changePublication(
    command: ReleasePublicationCommand
  ): Promise<ReleasePublicationReceipt>;
}

export function assertReleaseAccess(
  actor: EditorialActor,
  owner: { tenantId: string; ownerIdentityId: string },
  review = false
) {
  if (
    actor.tenantId !== owner.tenantId ||
    (review
      ? actor.identityId === owner.ownerIdentityId
      : actor.identityId !== owner.ownerIdentityId)
  )
    throw new PermissionDeniedError('editorial.release.publication');
}

/** Policy gates orchestration; storage repeats ownership and grant checks under canonical locks. */
export class ReleaseWorkspace {
  constructor(
    private readonly store: ReleaseWorkspaceStore,
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
    return this.store.read(actor, releaseId(id));
  }
  async source(
    actor: EditorialActor,
    applicationId: string,
    id: string | null
  ) {
    await this.authorize(actor, 'read');
    return this.store.source(
      actor,
      releaseId(applicationId),
      id === null ? null : releaseId(id)
    );
  }
  async status(actor: EditorialActor, id: string, review = false) {
    await this.authorize(actor, review ? 'review' : 'read', releaseId(id));
    return this.store.status(actor, id, review);
  }
  async reviews(actor: EditorialActor, page: number) {
    await this.authorize(actor, 'review');
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new ReleaseInputError('Invalid release review page');
    return this.store.reviews(actor, page);
  }

  async changeDraft(
    actor: EditorialActor,
    type: ReleaseDraftCommand['type'],
    id: string | null,
    input: unknown,
    key: string
  ) {
    if (!['create', 'open', 'update', 'rebase', 'delete'].includes(type))
      throw new ReleaseInputError('Invalid release command');
    await this.authorize(actor, type);
    this.assertKey(key);
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
    const data = releaseObject(input, keys[type]);
    const creating = type === 'create' || type === 'open';
    const expectedRevision = creating
      ? null
      : releaseRevision(data.expectedRevision);
    const expectedPublicationRevision =
      type === 'open'
        ? releaseRevision(data.expectedPublicationRevision)
        : type === 'rebase' && data.expectedPublicationRevision !== null
        ? releaseRevision(data.expectedPublicationRevision)
        : null;
    const fields =
      type === 'delete' || type === 'open'
        ? null
        : parseReleaseFields(data.fields);
    const requestedTarget = creating
      ? {
          applicationId: releaseId(data.applicationId),
          claimId: releaseId(data.claimId),
          releaseId: type === 'open' ? releaseId(data.releaseId) : null,
        }
      : null;
    const draftId = creating ? null : releaseId(id);
    return this.store.changeDraft({
      actor,
      type,
      key,
      fields,
      expectedRevision,
      expectedPublicationRevision,
      id: draftId ?? releaseId(this.ids.generate()),
      target: requestedTarget
        ? {
            ...requestedTarget,
            releaseId:
              requestedTarget.releaseId ?? releaseId(this.ids.generate()),
          }
        : null,
      at: releaseTimestamp(this.now()),
      fingerprint: this.fingerprint({
        type,
        id: draftId,
        fields,
        target: requestedTarget,
        expectedRevision,
        expectedPublicationRevision,
      }),
    });
  }
  async changePublication(
    actor: EditorialActor,
    id: string,
    action: ReleasePublicationAction,
    input: unknown,
    key: string
  ) {
    if (!['submit', 'approve', 'reject', 'withdraw'].includes(action))
      throw new ReleaseInputError('Invalid release publication action');
    await this.authorize(
      actor,
      action === 'approve' || action === 'reject' ? 'review' : action,
      releaseId(id)
    );
    this.assertKey(key);
    const parsed = parseReleasePublicationInput(action, input);
    return this.store.changePublication({
      actor,
      id,
      action,
      key,
      input: parsed,
      at: releaseTimestamp(this.now()),
      fingerprint: this.fingerprint({ action, id, input: parsed }),
    });
  }

  private fingerprint(input: unknown) {
    return createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }
  private assertKey(key: string) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new ReleaseInputError('A valid Idempotency-Key is required');
  }
  private async authorize(
    actor: EditorialActor,
    operation: string,
    id = actor.identityId
  ) {
    assertEditorialActor(actor);
    let result;
    try {
      result = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        timestamp: this.now(),
        actionName: `editorial.release.${operation}`,
        subject: { roles: actor.roles },
        resource: {
          type: operation === 'review' ? 'release-review' : 'release-workspace',
          id: operation === 'review' ? id : actor.identityId,
          tenantId: actor.tenantId,
        },
      });
    } catch {
      throw new ReleaseUnavailableError('Release authorization is unavailable');
    }
    if (!result.ok)
      throw new ReleaseUnavailableError('Release authorization is unavailable');
    if (result.value !== true)
      throw new PermissionDeniedError(`editorial.release.${operation}`);
  }
}
