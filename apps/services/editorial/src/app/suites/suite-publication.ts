import { createHash } from 'node:crypto';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  parseSuitePublicationInput,
  suiteId,
  SuiteInputError,
  SuiteUnavailableError,
  type SuitePublicationAction,
  type SuitePublicationInput,
  type SuitePublicationReceipt,
  type SuitePublicationStatus,
} from '@domains/publication/suite';
import { assertEditorialActor } from '../application/editorial-commands';
import type { EditorialActor } from '../application/editorial.ports';

export interface SuiteOwner {
  tenantId: string;
  ownerIdentityId: string;
}
export interface SuitePublicationCommand {
  actor: EditorialActor;
  id: string;
  action: SuitePublicationAction;
  input: SuitePublicationInput;
  key: string;
  fingerprint: string;
  at: number;
}
export interface SuiteReviewPage {
  items: SuitePublicationStatus[];
  page: number;
  total: number;
}
export interface SuitePublicationStore {
  read(
    actor: EditorialActor,
    id: string,
    review: boolean
  ): Promise<SuitePublicationStatus>;
  reviews(actor: EditorialActor, page: number): Promise<SuiteReviewPage>;
  commit(command: SuitePublicationCommand): Promise<SuitePublicationReceipt>;
}

/** Repeated under the SQL lock; approval cannot be granted by the submitter. */
export function assertSuitePublicationAccess(
  actor: EditorialActor,
  owner: SuiteOwner,
  review: boolean
) {
  if (
    actor.tenantId !== owner.tenantId ||
    (review
      ? actor.identityId === owner.ownerIdentityId
      : actor.identityId !== owner.ownerIdentityId)
  )
    throw new PermissionDeniedError('editorial.suite.publication');
}

export class SuitePublication {
  constructor(
    private readonly store: SuitePublicationStore,
    private readonly policy: IPolicyEvaluator,
    private readonly now: () => number = Date.now
  ) {}

  async read(actor: EditorialActor, id: string, review = false) {
    await this.authorize(actor, review ? 'review' : 'read', suiteId(id));
    return this.store.read(actor, id, review);
  }

  async reviews(actor: EditorialActor, page: number) {
    await this.authorize(actor, 'review', actor.identityId);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new SuiteInputError('Invalid review page');
    return this.store.reviews(actor, page);
  }

  async change(
    actor: EditorialActor,
    id: string,
    action: SuitePublicationAction,
    input: unknown,
    key: string
  ) {
    const review = action === 'approve' || action === 'reject';
    await this.authorize(actor, review ? 'review' : action, suiteId(id));
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new SuiteInputError('A valid Idempotency-Key is required');
    const parsed = parseSuitePublicationInput(action, input);
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
        actionName: `editorial.suite.${operation}`,
        subject: { roles: actor.roles },
        resource: {
          type: operation === 'review' ? 'suite-review' : 'suite-workspace',
          id: operation === 'review' ? id : actor.identityId,
          tenantId: actor.tenantId,
        },
      });
    } catch {
      throw new SuiteUnavailableError('Suite authorization is unavailable');
    }
    if (!result.ok)
      throw new SuiteUnavailableError('Suite authorization is unavailable');
    if (result.value !== true)
      throw new PermissionDeniedError(`editorial.suite.${operation}`);
  }
}
