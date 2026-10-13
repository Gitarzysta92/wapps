import { recordApplicationOwnershipHistory } from '../account-erasure/editorial-audit-erasure-schema';
import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import { lockIdentityWrites } from '@sdk/extras/identity-mysql';
import type { DataSource, EntityManager } from 'typeorm';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  OWNERSHIP_CHALLENGE_LIFETIME,
  OWNERSHIP_CHECK_INTERVAL,
  OWNERSHIP_CHECK_LIMIT,
  OWNERSHIP_PENDING_LIMIT,
  OwnershipConflictError,
  OwnershipInputError,
  OwnershipNotFoundError,
  OwnershipRateLimitError,
  OwnershipUnavailableError,
  assertOwnershipTransition,
  ownershipHostname,
  ownershipRevision,
  parseOwnershipClaim,
  parseOwnershipReceipt,
  type OwnershipClaim,
  type OwnershipReceipt,
} from '@domains/catalog/ownership';
import type { EditorialActor } from '../application/editorial.ports';
import {
  assertOwnershipClaimAccess,
  type ApplicationOwnershipStore,
  type OwnershipChangeCommand,
  type OwnershipCommand,
  type OwnershipCreateCommand,
  type OwnershipCheckReservation,
} from './application-ownership';

export interface OwnershipRow extends Record<string, unknown> {
  id: string;
  tenantId: string;
  claimantIdentityId: string;
  applicationId: string;
  reviewerIdentityId: string | null;
  checkCount: number;
  lastCheckAt: number | string | null;
}
interface ApplicationRow {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  isSuspended: number;
}
interface ApplicationState {
  tenantId: string;
  ownerIdentityId: string | null;
  revision: number | string;
  deletedAt: number | string | null;
}
export function ownershipClaimFromRow(row: OwnershipRow): OwnershipClaim {
  try {
    return parseOwnershipClaim({
      id: row.id,
      applicationId: row.applicationId,
      claimantIdentityId: row.claimantIdentityId,
      revision: Number(row.revision),
      applicationRevision: Number(row.applicationRevision),
      applicationName: row.applicationName,
      applicationSlug: row.applicationSlug,
      website: row.website,
      hostname: row.hostname,
      evidenceUrl: row.evidenceUrl,
      notes: row.notes,
      challengeName: row.challengeName,
      challengeValue: row.challengeValue,
      status: row.status,
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
      expiresAt: Number(row.expiresAt),
      verifiedAt: row.verifiedAt === null ? null : Number(row.verifiedAt),
      reviewedAt: row.reviewedAt === null ? null : Number(row.reviewedAt),
      reason: row.reason,
    });
  } catch {
    throw new OwnershipUnavailableError('Stored ownership claim is invalid');
  }
}

/** Claims are private canonical SQL data. Only grant/revocation changes public authority and creates outbox intent. */
export class MysqlApplicationOwnership implements ApplicationOwnershipStore {
  constructor(private readonly source: DataSource) {}
  async list(
    actor: EditorialActor,
    review: boolean,
    page: number,
    grants = false
  ) {
    return this.guard(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const where = review
          ? 'tenantId = ? AND claimantIdentityId <> ? AND status = ?'
          : 'tenantId = ? AND claimantIdentityId = ?';
        const scope = [
          actor.tenantId,
          actor.identityId,
          ...(review ? [grants ? 'approved' : 'awaiting-review'] : []),
        ];
        const [count] = await manager.query<{ total: string | number }[]>(
          `SELECT COUNT(*) AS total FROM application_ownership_claims WHERE ${where}`,
          scope
        );
        const rows = await manager.query<OwnershipRow[]>(
          `SELECT * FROM application_ownership_claims WHERE ${where} ORDER BY createdAt DESC, id LIMIT 20 OFFSET ?`,
          [...scope, (page - 1) * 20]
        );
        return {
          page,
          total: Number(count.total),
          items: rows.map(ownershipClaimFromRow),
        };
      })
    );
  }
  async read(actor: EditorialActor, id: string, review: boolean) {
    return this.guard(async () =>
      ownershipClaimFromRow(
        await this.row(this.source.manager, actor, id, review)
      )
    );
  }
  async create(command: OwnershipCreateCommand): Promise<OwnershipReceipt> {
    return this.guard(() =>
      this.source.transaction('READ COMMITTED', async (manager) => {
        await lockIdentityWrites(manager, [command.actor.identityId]);
        await this.workspace(
          manager,
          command.actor.tenantId,
          command.actor.identityId
        );
        const prior = await this.receipt(manager, command);
        if (prior) return prior;
        const { input, actor, at, id } = command;
        const [count] = await manager.query<{ total: number | string }[]>(
          "SELECT COUNT(*) AS total FROM application_ownership_claims WHERE tenantId = ? AND claimantIdentityId = ? AND (status IN ('awaiting-proof','awaiting-review') OR createdAt > ?)",
          [actor.tenantId, actor.identityId, at - 24 * 60 * 60 * 1000]
        );
        if (Number(count.total) >= OWNERSHIP_PENDING_LIMIT)
          throw new OwnershipRateLimitError(
            'You can have at most 20 pending or newly created ownership claims per day'
          );
        const duplicate = await manager.query(
          "SELECT id FROM application_ownership_claims WHERE tenantId = ? AND claimantIdentityId = ? AND applicationId = ? AND status IN ('awaiting-proof','awaiting-review','approved') LIMIT 1",
          [actor.tenantId, actor.identityId, input.applicationId]
        );
        if (duplicate.length)
          throw new OwnershipConflictError(
            'An active claim for this application already exists in your account'
          );
        const application = await this.application(
          manager,
          actor,
          input.applicationId,
          true
        );
        if (await this.activeGrant(manager, input.applicationId))
          throw new OwnershipConflictError(
            'This application already has verified ownership. Staff must resolve any dispute before another claim can be approved.'
          );
        if (!application.website)
          throw new OwnershipConflictError(
            'The application needs a canonical website before ownership can be verified'
          );
        const hostname = ownershipHostname(application.website);
        const claim = parseOwnershipClaim({
          id,
          ...input,
          claimantIdentityId: actor.identityId,
          revision: 1,
          applicationRevision: Number(application.revision),
          applicationName: application.name,
          applicationSlug: application.slug,
          website: application.website,
          hostname,
          challengeName: '_wapps-ownership.' + hostname,
          challengeValue: command.challenge,
          status: 'awaiting-proof',
          createdAt: at,
          updatedAt: at,
          expiresAt: at + OWNERSHIP_CHALLENGE_LIFETIME,
          verifiedAt: null,
          reviewedAt: null,
          reason: '',
        });
        await manager.query(
          `INSERT INTO application_ownership_claims
        (id, tenantId, claimantIdentityId, applicationId, revision, applicationRevision, applicationName, applicationSlug, website, hostname,
        evidenceUrl, notes, challengeName, challengeValue, status, createdAt, updatedAt, expiresAt, verifiedAt, reviewedAt, reviewerIdentityId, reason, checkCount, lastCheckAt)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting-proof', ?, ?, ?, NULL, NULL, NULL, '', 0, NULL)`,
          [
            id,
            actor.tenantId,
            actor.identityId,
            input.applicationId,
            claim.applicationRevision,
            claim.applicationName,
            claim.applicationSlug,
            claim.website,
            hostname,
            claim.evidenceUrl,
            claim.notes,
            claim.challengeName,
            claim.challengeValue,
            at,
            at,
            claim.expiresAt,
          ]
        );
        return this.saveReceipt(
          manager,
          command,
          {
            id,
            revision: 1,
            action: 'create',
            status: 'awaiting-proof',
            proofMatched: null,
            applicationRevision: null,
          },
          at
        );
      })
    );
  }
  async change(command: OwnershipChangeCommand): Promise<OwnershipReceipt> {
    if (command.action === 'verify')
      throw new OwnershipInputError(
        'Verification requires a reserved domain check'
      );
    return this.guard(() =>
      this.source.transaction('READ COMMITTED', async (manager) => {
        const row = await this.lockedClaim(manager, command);
        const prior = await this.receipt(manager, command);
        if (prior) return prior;
        const claim = ownershipClaimFromRow(row);
        const at = Math.max(command.at, claim.updatedAt);
        const publishing = ['approve', 'release', 'revoke'].includes(
          command.action
        );
        const application = publishing
          ? await this.application(
              manager,
              command.actor,
              claim.applicationId,
              command.action === 'approve'
            )
          : null;
        assertOwnershipTransition(
          command.action,
          claim,
          command.input,
          at,
          Number(application?.revision ?? claim.applicationRevision)
        );
        const revision = claim.revision + 1;
        const status =
          command.action === 'approve'
            ? 'approved'
            : command.action === 'reject'
            ? 'rejected'
            : command.action === 'cancel'
            ? 'cancelled'
            : 'revoked';
        let publicRevision: number | null = null;
        if (application) {
          const grant = await this.activeGrant(manager, claim.applicationId);
          if (command.action === 'approve') {
            await recordApplicationOwnershipHistory(
              manager,
              claim.applicationId,
              row.tenantId,
              at
            );
            if (grant)
              throw new OwnershipConflictError(
                'This application already has verified ownership'
              );
            await manager.query(
              `INSERT INTO application_ownership_grants (applicationId, tenantId, claimantIdentityId, claimId, grantedAt, revokedAt)
            VALUES (?, ?, ?, ?, ?, NULL) ON DUPLICATE KEY UPDATE tenantId = VALUES(tenantId), claimantIdentityId = VALUES(claimantIdentityId), claimId = VALUES(claimId), grantedAt = VALUES(grantedAt), revokedAt = NULL`,
              [
                claim.applicationId,
                row.tenantId,
                claim.claimantIdentityId,
                claim.id,
                at,
              ]
            );
          } else {
            if (
              !grant ||
              grant.claimId !== claim.id ||
              application.ownerIdentityId !== claim.claimantIdentityId
            )
              throw new OwnershipConflictError(
                'This ownership grant is no longer current'
              );
            await manager.query(
              'UPDATE application_ownership_grants SET revokedAt = ? WHERE applicationId = ?',
              [at, claim.applicationId]
            );
          }
          publicRevision = ownershipRevision(Number(application.revision) + 1);
          await manager.query(
            "UPDATE editorial_resource_states SET ownerIdentityId = ?, revision = ? WHERE resourceKind = 'app' AND resourceId = ? AND tenantId = ?",
            [
              claim.claimantIdentityId,
              publicRevision,
              claim.applicationId,
              row.tenantId,
            ]
          );
          await manager.query(
            `INSERT INTO editorial_outbox (resourceKind, resourceId, tenantId, revision, operation, actorIdentityId, createdAt, availableAt)
          VALUES ('app', ?, ?, ?, ?, ?, ?, ?)`,
            [
              claim.applicationId,
              row.tenantId,
              publicRevision,
              application.deletedAt === null ? 'publish' : 'withdraw',
              command.actor.identityId,
              at,
              at,
            ]
          );
        }
        const reason =
          command.action === 'release'
            ? command.input.reason || 'Ownership released by the claimant.'
            : command.input.reason;
        if (command.action !== 'cancel')
          await manager.query(
            `INSERT INTO application_ownership_decisions
          (claimId, revision, actorIdentityId, action, reason, verifiedAt, applicationRevision, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              claim.id,
              revision,
              command.actor.identityId,
              command.action,
              reason,
              claim.verifiedAt,
              publicRevision,
              at,
            ]
          );
        await manager.query(
          'UPDATE application_ownership_claims SET revision = ?, status = ?, updatedAt = ?, reviewedAt = ?, reviewerIdentityId = ?, reviewerErasedAt = NULL, reason = ? WHERE id = ?',
          [
            revision,
            status,
            at,
            command.action === 'cancel' ? null : at,
            command.action === 'cancel' ? null : command.actor.identityId,
            reason,
            claim.id,
          ]
        );
        return this.saveReceipt(
          manager,
          command,
          {
            id: claim.id,
            revision,
            action: command.action,
            status,
            proofMatched: null,
            applicationRevision: publicRevision,
          },
          at
        );
      })
    );
  }
  async reserveCheck(
    command: OwnershipChangeCommand,
    lease: string
  ): Promise<OwnershipCheckReservation> {
    if (command.action !== 'verify' || !/^[0-9a-f]{64}$/.test(lease))
      throw new OwnershipInputError(
        'Invalid ownership verification reservation'
      );
    return this.guard(() =>
      this.source.transaction('READ COMMITTED', async (manager) => {
        const row = await this.lockedClaim(manager, command);
        const receipt = await this.receipt(manager, command);
        if (receipt) return { receipt };
        const claim = ownershipClaimFromRow(row);
        const application = await this.application(
          manager,
          command.actor,
          claim.applicationId,
          true
        );
        assertOwnershipTransition(
          'verify',
          claim,
          command.input,
          command.at,
          Number(application.revision)
        );
        const [attempt] = await manager.query<
          {
            leaseUntil: number | string;
            executions: number;
            fingerprint: string;
          }[]
        >(
          'SELECT leaseUntil, executions, fingerprint FROM application_ownership_checks WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
          [command.actor.tenantId, command.actor.identityId, command.key]
        );
        if (attempt && Number(attempt.leaseUntil) > command.at)
          throw new OwnershipUnavailableError(
            'This domain check is still in progress. Retry the same request shortly.'
          );
        if (attempt && attempt.executions >= 3)
          throw new OwnershipConflictError(
            'This domain check exhausted recovery attempts. Reload and start another check.'
          );
        if (row.checkCount >= OWNERSHIP_CHECK_LIMIT)
          throw new OwnershipConflictError(
            'This challenge exhausted its domain checks. Cancel it and create a new claim.'
          );
        if (
          !attempt &&
          row.lastCheckAt !== null &&
          Number(row.lastCheckAt) + OWNERSHIP_CHECK_INTERVAL > command.at
        )
          throw new OwnershipRateLimitError(
            'Wait 30 seconds between domain checks'
          );
        await manager.query(
          `INSERT INTO application_ownership_checks (tenantId, actorIdentityId, commandKey, claimId, fingerprint, leaseToken, leaseUntil, executions, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE leaseToken = VALUES(leaseToken), leaseUntil = VALUES(leaseUntil), executions = executions + 1`,
          [
            command.actor.tenantId,
            command.actor.identityId,
            command.key,
            claim.id,
            command.fingerprint,
            lease,
            command.at + 15000,
            command.at,
          ]
        );
        await manager.query(
          'UPDATE application_ownership_claims SET checkCount = checkCount + 1, lastCheckAt = ? WHERE id = ?',
          [command.at, claim.id]
        );
        return { claim, lease };
      })
    );
  }
  async finishCheck(
    command: OwnershipChangeCommand,
    lease: string,
    matched: boolean,
    completedAt: number
  ): Promise<OwnershipReceipt> {
    return this.guard(() =>
      this.source.transaction('READ COMMITTED', async (manager) => {
        const row = await this.lockedClaim(manager, command);
        const prior = await this.receipt(manager, command);
        if (prior) return prior;
        const [attempt] = await manager.query<
          { leaseToken: string; leaseUntil: string | number }[]
        >(
          'SELECT leaseToken, leaseUntil FROM application_ownership_checks WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
          [command.actor.tenantId, command.actor.identityId, command.key]
        );
        if (
          !attempt ||
          attempt.leaseToken !== lease ||
          Number(attempt.leaseUntil) < completedAt
        )
          throw new OwnershipUnavailableError(
            'The domain check lease expired. Retry the same request.'
          );
        const claim = ownershipClaimFromRow(row);
        const application = await this.application(
          manager,
          command.actor,
          claim.applicationId,
          true
        );
        const at = Math.max(completedAt, claim.updatedAt);
        assertOwnershipTransition(
          'verify',
          claim,
          command.input,
          at,
          Number(application.revision)
        );
        const revision = claim.revision + 1;
        const status = matched ? 'awaiting-review' : 'awaiting-proof';
        await manager.query(
          'UPDATE application_ownership_claims SET revision = ?, status = ?, verifiedAt = ?, updatedAt = ? WHERE id = ?',
          [revision, status, matched ? at : null, at, claim.id]
        );
        return this.saveReceipt(
          manager,
          command,
          {
            id: claim.id,
            revision,
            action: 'verify',
            status,
            proofMatched: matched,
            applicationRevision: null,
          },
          at
        );
      })
    );
  }
  private async workspace(
    manager: EntityManager,
    tenantId: string,
    claimantIdentityId: string
  ) {
    await manager.query(
      'INSERT INTO application_ownership_workspaces (tenantId, claimantIdentityId) VALUES (?, ?) ON DUPLICATE KEY UPDATE claimantIdentityId = claimantIdentityId',
      [tenantId, claimantIdentityId]
    );
    await manager.query(
      'SELECT claimantIdentityId FROM application_ownership_workspaces WHERE tenantId = ? AND claimantIdentityId = ? FOR UPDATE',
      [tenantId, claimantIdentityId]
    );
  }
  private async row(
    manager: EntityManager,
    actor: EditorialActor,
    id: string,
    review: boolean,
    lock = false
  ) {
    const [row] = await manager.query<OwnershipRow[]>(
      'SELECT * FROM application_ownership_claims WHERE id = ? AND tenantId = ?' +
        (review ? '' : ' AND claimantIdentityId = ?') +
        (lock ? ' FOR UPDATE' : ''),
      [id, actor.tenantId, ...(review ? [] : [actor.identityId])]
    );
    if (!row) throw new OwnershipNotFoundError('Ownership claim not found');
    assertOwnershipClaimAccess(
      actor,
      row.tenantId,
      row.claimantIdentityId,
      review
    );
    return row;
  }
  private async lockedClaim(
    manager: EntityManager,
    command: OwnershipChangeCommand
  ) {
    const review = ['approve', 'reject', 'revoke'].includes(command.action);
    const previous = await this.row(manager, command.actor, command.id, review);
    await lockIdentityWrites(manager, [
      command.actor.identityId,
      previous.claimantIdentityId,
    ]);
    await this.workspace(
      manager,
      previous.tenantId,
      previous.claimantIdentityId
    );
    return this.row(manager, command.actor, command.id, review, true);
  }
  private async application(
    manager: EntityManager,
    actor: EditorialActor,
    id: string,
    live: boolean
  ) {
    // Match the public Editorial writer: application row, then canonical lifecycle row.
    const [application] = await manager.query<ApplicationRow[]>(
      'SELECT id, name, slug, website, isSuspended FROM app_records WHERE id = ? FOR UPDATE',
      [id]
    );
    const [state] = await manager.query<ApplicationState[]>(
      "SELECT tenantId, ownerIdentityId, revision, deletedAt FROM editorial_resource_states WHERE resourceKind = 'app' AND resourceId = ? FOR UPDATE",
      [id]
    );
    if (
      !application ||
      !state ||
      state.tenantId !== actor.tenantId ||
      (live && (state.deletedAt !== null || application.isSuspended))
    )
      throw new OwnershipNotFoundError(
        'Application not found or unavailable for ownership verification'
      );
    return { ...application, ...state };
  }
  private async activeGrant(manager: EntityManager, id: string) {
    const [grant] = await manager.query<{ claimId: string }[]>(
      'SELECT claimId FROM application_ownership_grants WHERE applicationId = ? AND revokedAt IS NULL',
      [id]
    );
    return grant ?? null;
  }
  private async receipt(
    manager: EntityManager,
    command: OwnershipCommand
  ): Promise<OwnershipReceipt | null> {
    const scope = [
      command.actor.tenantId,
      command.actor.identityId,
      command.key,
    ];
    const [attempt] = await manager.query<{ fingerprint: string }[]>(
      'SELECT fingerprint FROM application_ownership_checks WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
      scope
    );
    if (attempt && attempt.fingerprint !== command.fingerprint)
      throw new OwnershipConflictError(
        'Idempotency-Key was used for another command'
      );
    const [row] = await manager.query<
      { fingerprint: string; receipt: unknown }[]
    >(
      'SELECT fingerprint, receipt FROM application_ownership_commands WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
      scope
    );
    if (!row) return null;
    if (row.fingerprint !== command.fingerprint)
      throw new OwnershipConflictError(
        'Idempotency-Key was used for another command'
      );
    let receipt: OwnershipReceipt;
    try {
      receipt = parseOwnershipReceipt(
        typeof row.receipt === 'string' ? JSON.parse(row.receipt) : row.receipt
      );
    } catch {
      throw new OwnershipUnavailableError(
        'Stored ownership receipt is invalid'
      );
    }
    await this.row(
      manager,
      command.actor,
      receipt.id,
      ['approve', 'reject', 'revoke'].includes(command.action)
    );
    return receipt;
  }
  private async saveReceipt(
    manager: EntityManager,
    command: OwnershipCommand,
    value: OwnershipReceipt,
    at: number
  ) {
    const receipt = parseOwnershipReceipt(value);
    await manager.query(
      'INSERT INTO application_ownership_commands (tenantId, actorIdentityId, commandKey, claimId, fingerprint, receipt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        command.actor.tenantId,
        command.actor.identityId,
        command.key,
        receipt.id,
        command.fingerprint,
        JSON.stringify(receipt),
        at,
      ]
    );
    return receipt;
  }
  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof CanonicalIdentityAccessDenied ||
        error instanceof OwnershipInputError ||
        error instanceof OwnershipConflictError ||
        error instanceof OwnershipNotFoundError ||
        error instanceof OwnershipRateLimitError ||
        error instanceof OwnershipUnavailableError ||
        error instanceof PermissionDeniedError
      )
        throw error;
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      )
        throw new OwnershipConflictError(
          'This ownership command or claim already exists. Reload before continuing.'
        );
      throw new OwnershipUnavailableError(
        'Could not confirm ownership changes. Retry with the same Idempotency-Key.'
      );
    }
  }
}
