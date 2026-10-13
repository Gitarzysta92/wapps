import { createHash } from 'node:crypto';
import {
  accountExportId,
  isCanonicalIdentityId,
  parseAccountExportArtifact,
  parseAccountExportJob,
  AccountExportSourceInvalid,
  type AccountExportArtifact,
  type AccountExportJob,
} from '@sdk/features/identity/core';
import { canonicalSqlInteger } from './canonical-account-sql';

export type AccountExportRow = AccountExportJob & {
  identityId: string;
  commandKey: string;
  availableAt: number;
  leaseToken: string | null;
  leasedUntil: number | null;
  artifact: AccountExportArtifact | null;
};
export const accountExportDigest = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

export function accountExportFromSql(
  row: Record<string, unknown>
): AccountExportRow {
  try {
    const artifact =
      row.artifact === null
        ? null
        : parseAccountExportArtifact(
            typeof row.artifact === 'string'
              ? JSON.parse(row.artifact)
              : row.artifact
          );
    const view = parseAccountExportJob({
      id: row.id,
      status: row.status,
      requestedAt: canonicalSqlInteger(row.requestedAt, 1),
      expiresAt: canonicalSqlInteger(row.expiresAt, 1),
      attempts: canonicalSqlInteger(row.attempts),
      readyAt:
        row.readyAt === null ? null : canonicalSqlInteger(row.readyAt, 1),
      bytes: artifact?.bytes ?? null,
      sha256: artifact?.sha256 ?? null,
      failure: row.failure,
    });
    const availableAt = canonicalSqlInteger(row.availableAt, 1);
    const leasedUntil =
      row.leasedUntil === null ? null : canonicalSqlInteger(row.leasedUntil, 1);
    const leaseToken =
      row.leaseToken === null ? null : accountExportId(row.leaseToken);
    if (
      !isCanonicalIdentityId(row.identityId) ||
      typeof row.commandKey !== 'string' ||
      !/^[\x21-\x7e]{1,128}$/.test(row.commandKey) ||
      availableAt < view.requestedAt ||
      (view.status === 'building'
        ? leasedUntil === null ||
          leasedUntil > view.expiresAt ||
          leasedUntil <= view.requestedAt
        : leasedUntil !== null) ||
      ['building', 'ready'].includes(view.status) !== (leaseToken !== null)
    )
      throw new AccountExportSourceInvalid(
        'Invalid account export storage state'
      );
    return {
      ...view,
      identityId: row.identityId,
      commandKey: row.commandKey,
      availableAt,
      leasedUntil,
      leaseToken,
      artifact,
    };
  } catch (error) {
    if (error instanceof AccountExportSourceInvalid) throw error;
    throw new AccountExportSourceInvalid(
      'Invalid account export storage state'
    );
  }
}

export function accountExportView(
  row: AccountExportRow,
  at: number
): AccountExportJob {
  const expired = row.expiresAt <= at;
  return parseAccountExportJob({
    id: row.id,
    status: expired ? 'expired' : row.status,
    requestedAt: row.requestedAt,
    expiresAt: row.expiresAt,
    attempts: row.attempts,
    readyAt: expired ? null : row.readyAt,
    bytes: expired ? null : row.bytes,
    sha256: expired ? null : row.sha256,
    failure: expired ? null : row.failure,
  });
}
