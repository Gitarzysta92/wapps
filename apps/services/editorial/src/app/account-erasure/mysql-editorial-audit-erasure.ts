import type { DataSource, EntityManager } from 'typeorm';
import type { AccountErasureRequest } from '@sdk/features/identity/core';
import {
  isEditorialResourceId,
  isEditorialScope,
} from '../application/editorial-materialization';
import { editorialSqlInteger } from '../infrastructure/mysql-editorial-snapshot';
import {
  ownershipClaimFromRow,
  type OwnershipRow,
} from '../application-ownership/mysql-application-ownership';
import { lockEditorialErasure } from './mysql-editorial-erasure-authority';
import {
  editorialWorkspaceFamilies,
  EDITORIAL_WORKSPACE_ERASURE_BATCH as batch,
} from './editorial-workspace-erasure.tables';
import { assertEditorialReviewActor } from './editorial-audit-erasure-schema';
import type { EditorialAuditErasure } from './editorial-audit-erasure.port';

type Row = Record<string, unknown>;

export class MysqlEditorialAuditErasure implements EditorialAuditErasure {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  advance(input: AccountErasureRequest): Promise<'pending' | 'drained'> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const { request, requestedAt } = await lockEditorialErasure(
        manager,
        input
      );
      const owner = request.identityId;
      if (
        (
          await manager.query(
            'SELECT resourceId FROM editorial_resource_states WHERE ownerIdentityId=? LIMIT 1',
            [owner]
          )
        ).length
      )
        return 'pending';
      for (const family of editorialWorkspaceFamilies)
        for (const table of [family.drafts, family.workspace])
          if (
            (
              await manager.query(
                `SELECT ownerIdentityId FROM ${table} WHERE ownerIdentityId=? LIMIT 1`,
                [owner]
              )
            ).length
          )
            return 'pending';
      const [claim]: OwnershipRow[] = await manager.query(
        'SELECT * FROM application_ownership_claims WHERE claimantIdentityId=? ORDER BY id LIMIT 1 FOR UPDATE',
        [owner]
      );
      if (claim) {
        await this.eraseClaim(manager, claim, owner);
        return 'pending';
      }
      for (const table of [
        'application_ownership_checks',
        'application_ownership_commands',
        'editorial_commands',
      ]) {
        const result = await manager.query(
          `DELETE FROM ${table} WHERE actorIdentityId=? ORDER BY tenantId,commandKey LIMIT ${batch}`,
          [owner]
        );
        if (result.affectedRows) return 'pending';
      }
      const at = Math.max(requestedAt, editorialSqlInteger(this.now(), 1));
      const [decision]: Row[] = await manager.query(
        'SELECT claimId,revision FROM application_ownership_decisions WHERE actorIdentityId=? ORDER BY claimId,revision LIMIT 1',
        [owner]
      );
      if (decision) {
        await this.anonymizeOwnershipDecision(manager, decision, owner, at);
        return 'pending';
      }
      for (const family of editorialWorkspaceFamilies) {
        const [candidate]: Row[] = await manager.query(
          `SELECT ${family.parent} AS id,submittedRevision FROM ${family.submissions} WHERE reviewerIdentityId=? ORDER BY ${family.parent},submittedRevision LIMIT 1`,
          [owner]
        );
        if (!candidate) continue;
        const [draft]: Row[] = await manager.query(
          `SELECT ownerIdentityId,tenantId,deletedAt FROM ${family.drafts} WHERE id=? FOR UPDATE`,
          [candidate.id]
        );
        const [review]: Row[] = await manager.query(
          `SELECT * FROM ${family.submissions} WHERE ${family.parent}=? AND submittedRevision=? FOR UPDATE`,
          [candidate.id, candidate.submittedRevision]
        );
        if (!review) return 'pending';
        if (
          !draft ||
          !isEditorialScope(draft.ownerIdentityId) ||
          draft.ownerIdentityId === owner
        )
          throw new Error('Missing peer review erasure authority');
        if (review.reviewerIdentityId !== owner) return 'pending';
        const reviewedAt = editorialSqlInteger(review.reviewedAt, 1);
        assertEditorialReviewActor(
          {
            actor: review.reviewerIdentityId,
            owner: draft.ownerIdentityId,
            reviewedAt,
            decided:
              review.status === 'approved' || review.status === 'rejected',
            erasedAt: review.reviewerErasedAt,
          },
          true
        );
        await manager.query(
          `UPDATE ${family.submissions} SET reviewerIdentityId=NULL,reviewerErasedAt=? WHERE ${family.parent}=? AND submittedRevision=?`,
          [Math.max(at, reviewedAt), candidate.id, candidate.submittedRevision]
        );
        return 'pending';
      }
      const outbox = await manager.query(
        `UPDATE editorial_outbox SET actorIdentityId=NULL WHERE actorIdentityId=? ORDER BY id LIMIT ${batch}`,
        [owner]
      );
      if (outbox.affectedRows) return 'pending';
      for (const [table, column] of [
        ['application_ownership_grants', 'claimantIdentityId'],
        ['application_ownership_claims', 'reviewerIdentityId'],
      ] as const)
        if (
          (
            await manager.query(
              `SELECT ${column} FROM ${table} WHERE ${column}=? LIMIT 1`,
              [owner]
            )
          ).length
        )
          throw new Error(
            'Orphaned Editorial ownership attribution requires repair'
          );
      const workspaces = await manager.query(
        `DELETE FROM application_ownership_workspaces WHERE claimantIdentityId=? ORDER BY tenantId LIMIT ${batch}`,
        [owner]
      );
      return workspaces.affectedRows ? 'pending' : 'drained';
    });
  }

  private async eraseClaim(
    manager: EntityManager,
    row: OwnershipRow,
    owner: string
  ) {
    const claim = ownershipClaimFromRow(row);
    if (
      !isEditorialScope(row.tenantId) ||
      claim.claimantIdentityId !== owner ||
      claim.status === 'approved'
    )
      throw new Error('Editorial claim erasure requires terminated ownership');
    for (const [table, parent] of [
      ['application_editing_targets', 'draftId'],
      ['release_drafts', 'id'],
    ])
      if (
        (
          await manager.query(
            `SELECT ${parent} FROM ${table} WHERE claimId=? LIMIT 1`,
            [claim.id]
          )
        ).length
      )
        throw new Error(
          'Private authoring still depends on erased ownership claim'
        );
    for (const table of [
      'application_ownership_checks',
      'application_ownership_commands',
    ]) {
      const deleted = await manager.query(
        `DELETE FROM ${table} WHERE claimId=? ORDER BY tenantId,actorIdentityId,commandKey LIMIT ${batch}`,
        [claim.id]
      );
      if (deleted.affectedRows) return;
    }
    const [state]: Row[] = await manager.query(
      "SELECT tenantId,ownerIdentityId FROM editorial_resource_states WHERE resourceKind='app' AND resourceId=? FOR UPDATE",
      [claim.applicationId]
    );
    if (
      !state ||
      state.tenantId !== row.tenantId ||
      state.ownerIdentityId === owner
    )
      throw new Error('Missing anonymous or transferred ownership authority');
    const decisions: Row[] = await manager.query(
      'SELECT * FROM application_ownership_decisions WHERE claimId=? ORDER BY revision LIMIT 3 FOR UPDATE',
      [claim.id]
    );
    const expected =
      claim.status === 'revoked' ? 2 : claim.status === 'rejected' ? 1 : 0;
    const latest = decisions[decisions.length - 1];
    if (
      decisions.length !== expected ||
      (expected === 2 &&
        (decisions[0].action !== 'approve' ||
          !['revoke', 'release'].includes(String(latest.action)) ||
          Number(latest.revision) !== Number(decisions[0].revision) + 1)) ||
      (expected === 1 && latest.action !== 'reject') ||
      (latest &&
        (Number(latest.revision) !== claim.revision ||
          Number(latest.createdAt) !== claim.reviewedAt ||
          latest.actorIdentityId !== row.reviewerIdentityId ||
          String(latest.actorErasedAt ?? '') !==
            String(row.reviewerErasedAt ?? '') ||
          latest.reason !== claim.reason))
    )
      throw new Error('Invalid bounded ownership decision history');
    if (expected === 2) {
      const [history]: Row[] = await manager.query(
        'SELECT tenantId,establishedAt FROM application_ownership_history WHERE applicationId=? FOR UPDATE',
        [claim.applicationId]
      );
      if (
        !history ||
        history.tenantId !== row.tenantId ||
        editorialSqlInteger(history.establishedAt, 1) >
          editorialSqlInteger(decisions[0].createdAt, 1)
      )
        throw new Error('Missing permanent erased ownership authority');
    }
    const grants: Row[] = await manager.query(
      'SELECT * FROM application_ownership_grants WHERE claimId=? ORDER BY applicationId LIMIT 2 FOR UPDATE',
      [claim.id]
    );
    if (grants.length > 1)
      throw new Error('Conflicting erased ownership grants');
    for (const grant of grants) {
      const [history]: Row[] = await manager.query(
        'SELECT tenantId,establishedAt FROM application_ownership_history WHERE applicationId=? FOR UPDATE',
        [claim.applicationId]
      );
      if (
        grant.applicationId !== claim.applicationId ||
        grant.tenantId !== row.tenantId ||
        grant.claimantIdentityId !== owner ||
        grant.revokedAt === null ||
        !history ||
        history.tenantId !== row.tenantId ||
        editorialSqlInteger(history.establishedAt, 1) >
          editorialSqlInteger(grant.grantedAt, 1) ||
        editorialSqlInteger(grant.revokedAt, 1) < Number(grant.grantedAt)
      )
        throw new Error('Missing permanent erased ownership authority');
    }
    await manager.query(
      'DELETE FROM application_ownership_grants WHERE claimId=?',
      [claim.id]
    );
    await manager.query(
      'DELETE FROM application_ownership_decisions WHERE claimId=?',
      [claim.id]
    );
    await manager.query('DELETE FROM application_ownership_claims WHERE id=?', [
      claim.id,
    ]);
  }

  private async anonymizeOwnershipDecision(
    manager: EntityManager,
    candidate: Row,
    owner: string,
    at: number
  ) {
    if (!isEditorialResourceId(candidate.claimId))
      throw new Error('Invalid ownership decision target');
    const [claim]: OwnershipRow[] = await manager.query(
      'SELECT * FROM application_ownership_claims WHERE id=? FOR UPDATE',
      [candidate.claimId]
    );
    const [decision]: Row[] = await manager.query(
      'SELECT * FROM application_ownership_decisions WHERE claimId=? AND revision=? FOR UPDATE',
      [candidate.claimId, candidate.revision]
    );
    if (!decision) return;
    if (!claim || claim.claimantIdentityId === owner)
      throw new Error('Missing peer ownership decision authority');
    if (decision.actorIdentityId !== owner) return;
    const createdAt = editorialSqlInteger(decision.createdAt, 1);
    assertEditorialReviewActor(
      {
        actor: decision.actorIdentityId,
        owner: claim.claimantIdentityId,
        reviewedAt: createdAt,
        decided: true,
        self: decision.action === 'release',
        erasedAt: decision.actorErasedAt,
      },
      true
    );
    const erasedAt = Math.max(at, createdAt);
    await manager.query(
      'UPDATE application_ownership_decisions SET actorIdentityId=NULL,actorErasedAt=? WHERE claimId=? AND revision=?',
      [erasedAt, candidate.claimId, candidate.revision]
    );
    if (Number(claim.revision) === Number(candidate.revision)) {
      if (
        claim.reviewerIdentityId !== owner ||
        Number(claim.reviewedAt) !== createdAt ||
        claim.reason !== decision.reason
      )
        throw new Error('Current ownership review differs from its decision');
      await manager.query(
        'UPDATE application_ownership_claims SET reviewerIdentityId=NULL,reviewerErasedAt=? WHERE id=?',
        [erasedAt, candidate.claimId]
      );
    }
  }
}
