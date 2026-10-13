import {
  OWNERSHIP_CHALLENGE_LIFETIME,
  ownershipHostname,
  parseOwnershipClaimInput,
  parseOwnershipChangeInput,
} from '@domains/catalog/ownership';
import type { AccountExportEntry } from '@sdk/features/identity/core';
import {
  decodeExport,
  exportChoice,
  exportId,
  exportInteger,
  exportKey,
  exportNullableInteger,
  exportOwner,
  exportRows,
  exportText,
  invalidExport,
  type EditorialExportContext,
} from './editorial-export-sql';

/** Proof tokens and staff identities are deliberately absent from the SELECT lists. */
export async function* captureEditorialOwnership(
  context: EditorialExportContext
): AsyncIterable<AccountExportEntry> {
  const { reader, owner, entry } = context;
  for await (const row of exportRows(
    reader,
    `SELECT id, tenantId, claimantIdentityId, applicationId, revision, applicationRevision,
    applicationName, applicationSlug, website, hostname, evidenceUrl, notes, status, createdAt, updatedAt, expiresAt,
    verifiedAt, reviewedAt, reason, checkCount, lastCheckAt FROM application_ownership_claims WHERE claimantIdentityId = ?`,
    [owner],
    exportKey('id')
  )) {
    const tenantId = exportOwner(row, owner, 'claimantIdentityId');
    const claim = {
      ...decodeExport(() =>
        parseOwnershipClaimInput({
          applicationId: row.applicationId,
          evidenceUrl: row.evidenceUrl,
          notes: row.notes,
        })
      ),
      id: exportId(row.id),
      tenantId,
      revision: exportInteger(row.revision, 1),
      applicationRevision: exportInteger(row.applicationRevision, 1),
      applicationName: exportText(row.applicationName, 100),
      applicationSlug: exportText(row.applicationSlug, 80),
      website: exportText(row.website, 2048),
      hostname: exportText(row.hostname, 235),
      status: exportChoice(row.status, [
        'awaiting-proof',
        'awaiting-review',
        'approved',
        'rejected',
        'cancelled',
        'revoked',
      ]),
      createdAt: exportInteger(row.createdAt, 1),
      updatedAt: exportInteger(row.updatedAt, 1),
      expiresAt: exportInteger(row.expiresAt, 1),
      verifiedAt: exportNullableInteger(row.verifiedAt, 1),
      reviewedAt: exportNullableInteger(row.reviewedAt, 1),
      reason: exportText(row.reason, 1000),
      checkCount: exportInteger(row.checkCount),
      lastCheckAt: exportNullableInteger(row.lastCheckAt, 1),
    };
    if (
      decodeExport(() => ownershipHostname(claim.website)) !== claim.hostname ||
      claim.applicationName.trim().length < 2 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claim.applicationSlug) ||
      claim.updatedAt < claim.createdAt ||
      claim.checkCount > 10 ||
      (claim.checkCount === 0) !== (claim.lastCheckAt === null) ||
      (claim.lastCheckAt !== null && claim.lastCheckAt < claim.createdAt) ||
      claim.expiresAt !== claim.createdAt + OWNERSHIP_CHALLENGE_LIFETIME ||
      (claim.verifiedAt !== null &&
        (claim.verifiedAt < claim.createdAt ||
          claim.verifiedAt > claim.updatedAt ||
          claim.verifiedAt >= claim.expiresAt)) ||
      (claim.reviewedAt !== null &&
        (claim.reviewedAt < claim.createdAt ||
          claim.reviewedAt > claim.updatedAt)) ||
      ['approved', 'rejected', 'revoked'].includes(claim.status) !==
        (claim.reviewedAt !== null) ||
      (['awaiting-review', 'approved', 'revoked'].includes(claim.status) &&
        claim.verifiedAt === null) ||
      (claim.status === 'awaiting-proof' && claim.verifiedAt !== null)
    )
      return invalidExport();
    yield entry('ownership.claims', claim);
    for await (const decision of exportRows(
      reader,
      `SELECT revision, action, reason, verifiedAt, applicationRevision, createdAt
      FROM application_ownership_decisions WHERE claimId = ?`,
      [claim.id],
      exportKey('revision')
    )) {
      const revision = exportInteger(decision.revision, 2),
        createdAt = exportInteger(decision.createdAt, 1);
      const action = exportChoice(decision.action, [
        'approve',
        'reject',
        'revoke',
        'release',
      ]);
      const change = decodeExport(() =>
        parseOwnershipChangeInput(action, {
          expectedRevision: revision - 1,
          reason: decision.reason,
        })
      );
      const verifiedAt = exportNullableInteger(decision.verifiedAt, 1),
        applicationRevision = exportNullableInteger(
          decision.applicationRevision,
          2
        );
      if (
        revision > claim.revision ||
        createdAt < claim.createdAt ||
        createdAt > claim.updatedAt ||
        (verifiedAt !== null && verifiedAt > createdAt) ||
        (action !== 'reject' &&
          (verifiedAt === null || applicationRevision === null)) ||
        (action === 'reject' && applicationRevision !== null)
      )
        return invalidExport();
      yield entry('ownership.decisions', {
        claimId: claim.id,
        tenantId,
        revision,
        action,
        reason: change.reason,
        verifiedAt,
        applicationRevision,
        createdAt,
      });
    }
  }
  for await (const row of exportRows(
    reader,
    `SELECT g.applicationId, g.tenantId, g.claimantIdentityId, g.claimId, g.grantedAt, g.revokedAt,
    c.applicationId AS claimedApplicationId, c.tenantId AS claimedTenantId, c.claimantIdentityId AS claimedOwner
    FROM application_ownership_grants g LEFT JOIN application_ownership_claims c ON c.id = g.claimId
    WHERE g.claimantIdentityId = ?`,
    [owner],
    exportKey('g.applicationId')
  )) {
    const tenantId = exportOwner(row, owner, 'claimantIdentityId');
    const applicationId = exportId(row.applicationId),
      grantedAt = exportInteger(row.grantedAt, 1),
      revokedAt = exportNullableInteger(row.revokedAt, 1);
    if (
      row.claimedApplicationId !== applicationId ||
      row.claimedTenantId !== tenantId ||
      row.claimedOwner !== owner ||
      (revokedAt !== null && revokedAt < grantedAt)
    )
      return invalidExport();
    yield entry('ownership.grants', {
      applicationId,
      tenantId,
      claimId: exportId(row.claimId),
      grantedAt,
      revokedAt,
    });
  }
}
