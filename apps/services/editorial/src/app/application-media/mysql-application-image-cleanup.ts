import { randomBytes } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  APPLICATION_IMAGE_UNUSED_LIFETIME,
  ApplicationImageUnavailableError,
  applicationImageId,
  applicationImageInteger,
  applicationImageRetirementReason,
} from '@domains/catalog/media';
import type {
  ApplicationImageCleanupLease,
  ApplicationImageCleanupStore,
} from './application-image-cleanup';
import {
  applicationImageFromRow,
  type ApplicationImageRow,
} from './mysql-application-images';
import {
  APPLICATION_IMAGE_REFERENCE_TABLES,
  applicationImageReferenced,
  retireApplicationImage,
} from './application-image-retirement';

import { lockEditorialMediaAsset } from './editorial-media-assets';
import {
  editorialRetirementConflict,
  retireUnreferencedEditorialAssets,
} from './editorial-media-retirement';

export const APPLICATION_IMAGE_CLEANUP_ATTEMPTS = 8;
export const APPLICATION_IMAGE_CLEANUP_LEASE_MS = 30_000;
export interface ApplicationImageCleanupRow {
  imageId: string;
  reason: string;
  createdAt: string | number;
  availableAt: string | number;
  attempts: number;
  leaseToken: string | null;
  leaseUntil: string | number | null;
  completedAt: string | number | null;
  failedAt: string | number | null;
  lastError: string | null;
}

export function validateApplicationImageCleanup(
  row: ApplicationImageCleanupRow
) {
  applicationImageId(row.imageId);
  const createdAt = applicationImageInteger(
    Number(row.createdAt),
    8_640_000_000_000_000
  );
  if (
    !['cancelled', 'expired', 'unreferenced', 'draft-deleted'].includes(
      row.reason
    ) ||
    !Number.isInteger(row.attempts) ||
    row.attempts < 0 ||
    row.attempts > APPLICATION_IMAGE_CLEANUP_ATTEMPTS ||
    Number(row.availableAt) < createdAt ||
    (row.leaseToken === null) !== (row.leaseUntil === null) ||
    (row.completedAt !== null && row.failedAt !== null) ||
    ((row.completedAt !== null || row.failedAt !== null) &&
      row.leaseToken !== null) ||
    (row.leaseToken !== null &&
      (!/^[a-f0-9]{64}$/.test(row.leaseToken) ||
        row.attempts === 0 ||
        Number(row.leaseUntil) <= Number(row.availableAt))) ||
    (row.attempts === 0 &&
      row.lastError !== null &&
      row.lastError !== 'canonical-reference-conflict') ||
    (row.attempts > 0 &&
      row.leaseToken === null &&
      row.completedAt === null &&
      row.lastError === null) ||
    (row.completedAt !== null &&
      (row.attempts === 0 ||
        row.lastError !== null ||
        Number(row.completedAt) < Number(row.availableAt))) ||
    (row.failedAt !== null && row.lastError === null) ||
    (['canonical-reference-conflict', 'lease-attempts-exhausted'].includes(
      row.lastError ?? ''
    ) &&
      row.failedAt === null) ||
    (row.failedAt !== null &&
      row.lastError !== 'canonical-reference-conflict' &&
      row.attempts !== APPLICATION_IMAGE_CLEANUP_ATTEMPTS) ||
    (row.lastError !== null &&
      ![
        'storage-or-receipt-unavailable',
        'lease-attempts-exhausted',
        'canonical-reference-conflict',
      ].includes(row.lastError))
  )
    throw new ApplicationImageUnavailableError(
      'Stored image cleanup state is invalid'
    );
  for (const value of [
    row.availableAt,
    row.leaseUntil,
    row.completedAt,
    row.failedAt,
  ])
    if (
      value !== null &&
      applicationImageInteger(Number(value), 8_640_000_000_000_000) < createdAt
    )
      throw new ApplicationImageUnavailableError(
        'Stored image cleanup timestamp is invalid'
      );
}

export class MysqlApplicationImageCleanup
  implements ApplicationImageCleanupStore
{
  constructor(private readonly source: DataSource) {}
  async retireUnused(at: number, limit: number) {
    applicationImageInteger(at, 8_640_000_000_000_000);
    applicationImageInteger(limit, 50);
    const candidates = await this.source.query<{ id: string }[]>(
      `SELECT i.id FROM application_image_uploads i JOIN application_drafts d ON d.id = i.draftId AND d.tenantId = i.tenantId AND d.ownerIdentityId = i.ownerIdentityId
      WHERE i.status IN ('pending', 'ready') AND (d.deletedAt IS NOT NULL OR (i.status = 'pending' AND i.expiresAt <= ?) OR (i.status = 'ready' AND i.createdAt <= ?))
      AND ${APPLICATION_IMAGE_REFERENCE_TABLES.map(
        (table) =>
          `NOT EXISTS (SELECT 1 FROM ${table} r WHERE r.imageId = i.id)`
      ).join(' AND ')}
      ORDER BY i.createdAt, i.id LIMIT ?`,
      [at, Math.max(0, at - APPLICATION_IMAGE_UNUSED_LIFETIME), limit]
    );
    let retired = 0;
    for (const candidate of candidates)
      if (
        await this.source.transaction('READ COMMITTED', async (manager) => {
          const [row] = await manager.query<ApplicationImageRow[]>(
            'SELECT * FROM application_image_uploads WHERE id = ? FOR UPDATE',
            [candidate.id]
          );
          if (!row)
            throw new ApplicationImageUnavailableError(
              'Image cleanup authority is missing'
            );
          const [draft] = await manager.query<
            { deletedAt: number | string | null }[]
          >(
            'SELECT deletedAt FROM application_drafts WHERE id = ? AND tenantId = ? AND ownerIdentityId = ?',
            [row.draftId, row.tenantId, row.ownerIdentityId]
          );
          if (!draft)
            throw new ApplicationImageUnavailableError(
              'Image cleanup draft authority is missing'
            );
          const upload = applicationImageFromRow(row);
          const reason = applicationImageRetirementReason(
            upload,
            await applicationImageReferenced(manager, row.id),
            draft.deletedAt !== null,
            at
          );
          if (!reason) return false;
          await retireApplicationImage(
            manager,
            row.id,
            upload.revision,
            at,
            reason
          );
          return true;
        })
      )
        retired++;
    if (retired < limit)
      retired += await retireUnreferencedEditorialAssets(
        this.source,
        'application',
        at,
        limit - retired
      );
    return retired;
  }
  async claim(at: number) {
    applicationImageInteger(at, 8_640_000_000_000_000);
    const candidates = await this.source.query<{ imageId: string }[]>(
      'SELECT imageId FROM application_image_cleanup WHERE completedAt IS NULL AND failedAt IS NULL AND availableAt <= ? AND (leaseUntil IS NULL OR leaseUntil <= ?) ORDER BY availableAt, imageId LIMIT 20',
      [at, at]
    );
    for (const candidate of candidates) {
      const lease = await this.source.transaction(
        'READ COMMITTED',
        async (manager) => {
          // Cancellation, orphan retirement and claims lock upload, registry, then cleanup.
          const [image] = await manager.query<ApplicationImageRow[]>(
            'SELECT * FROM application_image_uploads WHERE id = ? FOR UPDATE',
            [candidate.imageId]
          );
          const asset = await lockEditorialMediaAsset(
            manager,
            'application',
            candidate.imageId
          );
          const [row] = await manager.query<ApplicationImageCleanupRow[]>(
            'SELECT * FROM application_image_cleanup WHERE imageId = ? FOR UPDATE',
            [candidate.imageId]
          );
          if (!row)
            throw new ApplicationImageUnavailableError(
              'Image cleanup intent is missing'
            );
          validateApplicationImageCleanup(row);
          if (
            row.completedAt !== null ||
            row.failedAt !== null ||
            Number(row.availableAt) > at ||
            (row.leaseUntil !== null && Number(row.leaseUntil) > at)
          )
            return null;
          const conflict =
            editorialRetirementConflict(asset, Number(row.createdAt), image) ||
            (await applicationImageReferenced(manager, candidate.imageId));
          if (conflict || row.attempts >= APPLICATION_IMAGE_CLEANUP_ATTEMPTS) {
            await manager.query(
              'UPDATE application_image_cleanup SET failedAt = ?, leaseToken = NULL, leaseUntil = NULL, lastError = ? WHERE imageId = ?',
              [
                at,
                conflict
                  ? 'canonical-reference-conflict'
                  : 'lease-attempts-exhausted',
                candidate.imageId,
              ]
            );
            return null;
          }
          const token = randomBytes(32).toString('hex');
          await manager.query(
            'UPDATE application_image_cleanup SET attempts = attempts + 1, leaseToken = ?, leaseUntil = ? WHERE imageId = ?',
            [token, at + APPLICATION_IMAGE_CLEANUP_LEASE_MS, candidate.imageId]
          );
          return { imageId: candidate.imageId, token };
        }
      );
      if (lease) return lease;
    }
    return null;
  }
  async complete(lease: ApplicationImageCleanupLease, at: number) {
    validateLease(lease, at);
    const result: { affectedRows: number } = await this.source.query(
      'UPDATE application_image_cleanup SET completedAt = ?, leaseToken = NULL, leaseUntil = NULL, lastError = NULL WHERE imageId = ? AND leaseToken = ? AND leaseUntil > ? AND leaseUntil - ? <= ? AND completedAt IS NULL AND failedAt IS NULL',
      [
        at,
        lease.imageId,
        lease.token,
        at,
        APPLICATION_IMAGE_CLEANUP_LEASE_MS,
        at,
      ]
    );
    return result.affectedRows === 1;
  }
  async fail(lease: ApplicationImageCleanupLease, at: number) {
    validateLease(lease, at);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const [row] = await manager.query<ApplicationImageCleanupRow[]>(
        'SELECT * FROM application_image_cleanup WHERE imageId = ? FOR UPDATE',
        [lease.imageId]
      );
      if (
        !row ||
        row.leaseToken !== lease.token ||
        row.leaseUntil === null ||
        Number(row.leaseUntil) <= at ||
        Number(row.leaseUntil) - APPLICATION_IMAGE_CLEANUP_LEASE_MS > at ||
        row.completedAt !== null ||
        row.failedAt !== null
      )
        return 'stale' as const;
      validateApplicationImageCleanup(row);
      const failed = row.attempts >= APPLICATION_IMAGE_CLEANUP_ATTEMPTS;
      await manager.query(
        'UPDATE application_image_cleanup SET availableAt = ?, failedAt = ?, lastError = ?, leaseToken = NULL, leaseUntil = NULL WHERE imageId = ?',
        [
          at + Math.min(300_000, 1000 * 2 ** (row.attempts - 1)),
          failed ? at : null,
          'storage-or-receipt-unavailable',
          row.imageId,
        ]
      );
      return failed ? ('failed' as const) : ('scheduled' as const);
    });
  }
  async status() {
    return this.source.transaction('REPEATABLE READ', async (manager) => ({
      counts: await manager.query(
        "SELECT CASE WHEN completedAt IS NOT NULL THEN 'completed' WHEN failedAt IS NOT NULL THEN 'failed' WHEN leaseToken IS NOT NULL THEN 'leased' ELSE 'pending' END AS status, COUNT(*) AS total FROM application_image_cleanup GROUP BY status"
      ),
      failures: await manager.query(
        'SELECT imageId, reason, attempts, failedAt, lastError FROM application_image_cleanup WHERE failedAt IS NOT NULL ORDER BY failedAt, imageId LIMIT 20'
      ),
    }));
  }
  async requeue(id: string, at: number) {
    applicationImageId(id);
    applicationImageInteger(at, 8_640_000_000_000_000);
    const result: { affectedRows: number } = await this.source.query(
      'UPDATE application_image_cleanup SET attempts = 0, failedAt = NULL, lastError = NULL, availableAt = ? WHERE imageId = ? AND failedAt IS NOT NULL AND failedAt <= ? AND completedAt IS NULL AND leaseToken IS NULL AND leaseUntil IS NULL',
      [at, id, at]
    );
    return result.affectedRows === 1;
  }
}

function validateLease(lease: ApplicationImageCleanupLease, at: number) {
  applicationImageId(lease.imageId);
  applicationImageInteger(at, 8_640_000_000_000_000);
  if (!/^[a-f0-9]{64}$/.test(lease.token))
    throw new ApplicationImageUnavailableError('Invalid image cleanup lease');
}
