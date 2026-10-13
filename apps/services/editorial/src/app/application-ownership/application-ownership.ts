import { createHash } from 'node:crypto';
import {
  OwnershipInputError,
  OwnershipUnavailableError,
  ownershipId,
  parseOwnershipChangeInput,
  parseOwnershipClaimInput,
  type OwnershipAction,
  type OwnershipChangeInput,
  type OwnershipClaim,
  type OwnershipClaimInput,
  type OwnershipPage,
  type OwnershipReceipt,
} from '@domains/catalog/ownership';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import { assertEditorialActor } from '../application/editorial-commands';
import type { EditorialActor } from '../application/editorial.ports';

export interface OwnershipCommand {
  actor: EditorialActor;
  id: string;
  key: string;
  fingerprint: string;
  action: OwnershipAction;
  at: number;
}
export interface OwnershipCreateCommand extends OwnershipCommand {
  action: 'create';
  input: OwnershipClaimInput;
  challenge: string;
}
export interface OwnershipChangeCommand extends OwnershipCommand {
  action: Exclude<OwnershipAction, 'create'>;
  input: OwnershipChangeInput;
}
export type OwnershipCheckReservation =
  | { receipt: OwnershipReceipt }
  | { claim: OwnershipClaim; lease: string };
export interface ApplicationOwnershipStore {
  list(
    actor: EditorialActor,
    review: boolean,
    page: number,
    grants?: boolean
  ): Promise<OwnershipPage>;
  read(
    actor: EditorialActor,
    id: string,
    review: boolean
  ): Promise<OwnershipClaim>;
  create(command: OwnershipCreateCommand): Promise<OwnershipReceipt>;
  change(command: OwnershipChangeCommand): Promise<OwnershipReceipt>;
  reserveCheck(
    command: OwnershipChangeCommand,
    lease: string
  ): Promise<OwnershipCheckReservation>;
  finishCheck(
    command: OwnershipChangeCommand,
    lease: string,
    matched: boolean,
    at: number
  ): Promise<OwnershipReceipt>;
}
export interface OwnershipProof {
  matches(name: string, value: string): Promise<boolean>;
}
export function assertOwnershipClaimAccess(
  actor: EditorialActor,
  tenantId: string,
  claimantIdentityId: string,
  review: boolean
) {
  if (
    actor.tenantId !== tenantId ||
    (review
      ? actor.identityId === claimantIdentityId
      : actor.identityId !== claimantIdentityId)
  )
    throw new PermissionDeniedError('editorial.ownership.claim');
}

export class ApplicationOwnership {
  constructor(
    private readonly store: ApplicationOwnershipStore,
    private readonly proof: OwnershipProof,
    private readonly policy: IPolicyEvaluator,
    private readonly random: { id(): string; token(): string },
    private readonly now: () => number = Date.now
  ) {}
  async list(
    actor: EditorialActor,
    review: boolean,
    page: number,
    grants = false
  ) {
    await this.authorize(actor, review ? 'review' : 'read', actor.identityId);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 10000 ||
      (grants && !review)
    )
      throw new OwnershipInputError('Invalid ownership page');
    return this.store.list(actor, review, page, grants);
  }
  async read(actor: EditorialActor, id: string, review = false) {
    await this.authorize(actor, review ? 'review' : 'read', ownershipId(id));
    return this.store.read(actor, id, review);
  }
  async create(actor: EditorialActor, input: unknown, key: string) {
    await this.authorize(actor, 'create', actor.identityId);
    this.key(key);
    const parsed = parseOwnershipClaimInput(input);
    const challenge = this.random.token();
    if (!/^[0-9a-f]{64}$/.test(challenge))
      throw new OwnershipUnavailableError(
        'Ownership challenge generation failed'
      );
    return this.store.create({
      actor,
      key,
      id: ownershipId(this.random.id()),
      action: 'create',
      input: parsed,
      challenge: 'wapps-ownership=' + challenge,
      at: this.now(),
      fingerprint: this.fingerprint('create', null, parsed),
    });
  }
  async change(
    actor: EditorialActor,
    id: string,
    action: Exclude<OwnershipAction, 'create'>,
    input: unknown,
    key: string
  ) {
    await this.authorize(
      actor,
      action === 'approve' || action === 'reject' ? 'review' : action,
      ownershipId(id)
    );
    this.key(key);
    const parsed = parseOwnershipChangeInput(action, input);
    const command: OwnershipChangeCommand = {
      actor,
      id,
      key,
      action,
      input: parsed,
      at: this.now(),
      fingerprint: this.fingerprint(action, id, parsed),
    };
    if (action !== 'verify') return this.store.change(command);
    const reservation = await this.store.reserveCheck(
      command,
      this.random.token()
    );
    if ('receipt' in reservation) return reservation.receipt;
    // DNS runs outside SQL locks. Completion is fenced to this reservation and the loaded claim revision.
    let matched: boolean;
    try {
      matched = await this.proof.matches(
        reservation.claim.challengeName,
        reservation.claim.challengeValue
      );
    } catch {
      throw new OwnershipUnavailableError(
        'Domain verification is unavailable. Retry the same request.'
      );
    }
    return this.store.finishCheck(
      command,
      reservation.lease,
      matched,
      this.now()
    );
  }
  private key(key: string) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new OwnershipInputError('A valid Idempotency-Key is required');
  }
  private fingerprint(
    action: OwnershipAction,
    id: string | null,
    input: unknown
  ) {
    return createHash('sha256')
      .update(JSON.stringify({ action, id, input }))
      .digest('hex');
  }
  private async authorize(
    actor: EditorialActor,
    operation:
      | 'read'
      | 'create'
      | 'verify'
      | 'cancel'
      | 'release'
      | 'review'
      | 'revoke',
    id: string
  ) {
    assertEditorialActor(actor);
    let result;
    const review = operation === 'review' || operation === 'revoke';
    try {
      result = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        timestamp: this.now(),
        actionName: `editorial.ownership.${operation}`,
        subject: { roles: actor.roles },
        resource: {
          type: review ? 'ownership-review' : 'ownership-workspace',
          id: review ? id : actor.identityId,
          tenantId: actor.tenantId,
        },
      });
    } catch {
      throw new OwnershipUnavailableError(
        'Ownership authorization is unavailable'
      );
    }
    if (!result.ok)
      throw new OwnershipUnavailableError(
        'Ownership authorization is unavailable'
      );
    if (result.value !== true)
      throw new PermissionDeniedError(`editorial.ownership.${operation}`);
  }
}
