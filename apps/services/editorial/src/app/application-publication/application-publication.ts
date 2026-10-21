import { createHash } from 'node:crypto';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  parseApplicationPublicationInput,
  applicationDraftId,
  ApplicationDraftInputError,
  ApplicationDraftUnavailableError,
  type ApplicationPublicationAction,
  type ApplicationPublicationInput,
  type ApplicationPublicationReceipt,
  type ApplicationPublicationStatus,
} from '@domains/catalog/record';
import { assertEditorialActor } from '../application/editorial-commands';
import type { EditorialActor } from '../application/editorial.ports';

export interface ApplicationOwner {
  tenantId: string;
  ownerIdentityId: string;
}
export interface ApplicationPublicationCommand {
  actor: EditorialActor;
  id: string;
  action: ApplicationPublicationAction;
  input: ApplicationPublicationInput;
  key: string;
  fingerprint: string;
  at: number;
}
export interface ApplicationReviewPage {
  items: ApplicationPublicationStatus[];
  page: number;
  total: number;
}
export interface ApplicationPublicationStore {
  read(
    actor: EditorialActor,
    id: string,
    review: boolean
  ): Promise<ApplicationPublicationStatus>;
  reviews(actor: EditorialActor, page: number): Promise<ApplicationReviewPage>;
  commit(
    command: ApplicationPublicationCommand
  ): Promise<ApplicationPublicationReceipt>;
}

/** Repeated under the SQL lock; approval cannot be granted by the submitter. */
export function assertApplicationPublicationAccess(
  actor: EditorialActor,
  owner: ApplicationOwner,
  review: boolean
) {
  if (
    actor.tenantId !== owner.tenantId ||
    (review
      ? actor.identityId === owner.ownerIdentityId
      : actor.identityId !== owner.ownerIdentityId)
  )
    throw new PermissionDeniedError('editorial.application.publication');
}

export class ApplicationPublication {
  constructor(
    private readonly store: ApplicationPublicationStore,
    private readonly policy: IPolicyEvaluator,
    private readonly now: () => number = Date.now
  ) {}

  async read(actor: EditorialActor, id: string, review = false) {
    await this.authorize(
      actor,
      review ? 'review' : 'read',
      applicationDraftId(id)
    );
    return this.store.read(actor, id, review);
  }

  async reviews(actor: EditorialActor, page: number) {
    await this.authorize(actor, 'review', actor.identityId);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new ApplicationDraftInputError('Invalid review page');
    return this.store.reviews(actor, page);
  }

  async change(
    actor: EditorialActor,
    id: string,
    action: ApplicationPublicationAction,
    input: unknown,
    key: string
  ) {
    const review = action === 'approve' || action === 'reject';
    await this.authorize(
      actor,
      review ? 'review' : action,
      applicationDraftId(id)
    );
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new ApplicationDraftInputError(
        'A valid Idempotency-Key is required'
      );
    const parsed = parseApplicationPublicationInput(action, input);
    return this.store.commit({
      actor,
      id,
      action,
      input: parsed,
      key,
      at: this.now(),
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ action, id, input: parsed }))
        .digest('hex'),
    });
  }

  private async authorize(
    actor: EditorialActor,
    operation: 'read' | 'submit' | 'withdraw' | 'review',
    id: string
  ) {
    assertEditorialActor(actor);
    let result;
    try {
      result = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        timestamp: this.now(),
        actionName: `editorial.application.${operation}`,
        subject: { roles: actor.roles },
        resource: {
          type:
            operation === 'review'
              ? 'application-review'
              : 'application-workspace',
          id: operation === 'review' ? id : actor.identityId,
          tenantId: actor.tenantId,
        },
      });
    } catch {
      throw new ApplicationDraftUnavailableError(
        'Application authorization is unavailable'
      );
    }
    if (!result.ok)
      throw new ApplicationDraftUnavailableError(
        'Application authorization is unavailable'
      );
    if (result.value !== true)
      throw new PermissionDeniedError(`editorial.application.${operation}`);
  }
}
