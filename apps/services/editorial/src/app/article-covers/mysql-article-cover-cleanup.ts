import { randomBytes } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  ARTICLE_COVER_UNUSED_LIFETIME,
  ArticleCoverUnavailableError,
  articleCoverId,
  articleCoverInteger,
  articleCoverRetirementReason,
} from '@domains/catalog/media';
import type {
  ArticleCoverCleanupLease,
  ArticleCoverCleanupStore,
} from './article-cover-cleanup';
import {
  articleCoverFromRow,
  type ArticleCoverRow,
} from './mysql-article-covers';
import {
  ARTICLE_COVER_REFERENCE_TABLES,
  articleCoverReferenced,
  retireArticleCover,
} from './article-cover-retirement';

import { lockEditorialMediaAsset } from '../application-media/editorial-media-assets';
import {
  editorialRetirementConflict,
  retireUnreferencedEditorialAssets,
} from '../application-media/editorial-media-retirement';

export const ARTICLE_COVER_CLEANUP_ATTEMPTS = 8;
export const ARTICLE_COVER_CLEANUP_LEASE_MS = 30_000;
export interface ArticleCoverCleanupRow {
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

export function validateArticleCoverCleanup(row: ArticleCoverCleanupRow) {
  articleCoverId(row.imageId);
  const createdAt = articleCoverInteger(
    Number(row.createdAt),
    8_640_000_000_000_000
  );
  if (
    !['cancelled', 'expired', 'unreferenced', 'draft-deleted'].includes(
      row.reason
    ) ||
    !Number.isInteger(row.attempts) ||
    row.attempts < 0 ||
    row.attempts > ARTICLE_COVER_CLEANUP_ATTEMPTS ||
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
      row.attempts !== ARTICLE_COVER_CLEANUP_ATTEMPTS) ||
    (row.lastError !== null &&
      ![
        'storage-or-receipt-unavailable',
        'lease-attempts-exhausted',
        'canonical-reference-conflict',
      ].includes(row.lastError))
  )
    throw new ArticleCoverUnavailableError(
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
      articleCoverInteger(Number(value), 8_640_000_000_000_000) < createdAt
    )
      throw new ArticleCoverUnavailableError(
        'Stored image cleanup timestamp is invalid'
      );
}

export class MysqlArticleCoverCleanup implements ArticleCoverCleanupStore {
  constructor(private readonly source: DataSource) {}
  async retireUnused(at: number, limit: number) {
    articleCoverInteger(at, 8_640_000_000_000_000);
    articleCoverInteger(limit, 50);
    const candidates = await this.source.query<{ id: string }[]>(
      `SELECT i.id FROM article_cover_uploads i JOIN article_drafts d ON d.id = i.articleId AND d.tenantId = i.tenantId AND d.ownerIdentityId = i.ownerIdentityId
      WHERE i.status IN ('pending', 'ready') AND (d.deletedAt IS NOT NULL OR (i.status = 'pending' AND i.expiresAt <= ?) OR (i.status = 'ready' AND i.createdAt <= ?))
      AND ${ARTICLE_COVER_REFERENCE_TABLES.map(
        (table) =>
          `NOT EXISTS (SELECT 1 FROM ${table} r WHERE r.imageId = i.id)`
      ).join(' AND ')}
      ORDER BY i.createdAt, i.id LIMIT ?`,
      [at, Math.max(0, at - ARTICLE_COVER_UNUSED_LIFETIME), limit]
    );
    let retired = 0;
    for (const candidate of candidates)
      if (
        await this.source.transaction('READ COMMITTED', async (manager) => {
          const [row] = await manager.query<ArticleCoverRow[]>(
            'SELECT * FROM article_cover_uploads WHERE id = ? FOR UPDATE',
            [candidate.id]
          );
          if (!row)
            throw new ArticleCoverUnavailableError(
              'Image cleanup authority is missing'
            );
          const [draft] = await manager.query<
            { deletedAt: number | string | null }[]
          >(
            'SELECT deletedAt FROM article_drafts WHERE id = ? AND tenantId = ? AND ownerIdentityId = ?',
            [row.articleId, row.tenantId, row.ownerIdentityId]
          );
          if (!draft)
            throw new ArticleCoverUnavailableError(
              'Image cleanup draft authority is missing'
            );
          const upload = articleCoverFromRow(row);
          const reason = articleCoverRetirementReason(
            upload,
            await articleCoverReferenced(manager, row.id),
            draft.deletedAt !== null,
            at
          );
          if (!reason) return false;
          await retireArticleCover(
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
        'article',
        at,
        limit - retired
      );
    return retired;
  }
  async claim(at: number) {
    articleCoverInteger(at, 8_640_000_000_000_000);
    const candidates = await this.source.query<{ imageId: string }[]>(
      'SELECT imageId FROM article_cover_cleanup WHERE completedAt IS NULL AND failedAt IS NULL AND availableAt <= ? AND (leaseUntil IS NULL OR leaseUntil <= ?) ORDER BY availableAt, imageId LIMIT 20',
      [at, at]
    );
    for (const candidate of candidates) {
      const lease = await this.source.transaction(
        'READ COMMITTED',
        async (manager) => {
          // Cancellation, orphan retirement and claims lock upload, registry, then cleanup.
          const [image] = await manager.query<ArticleCoverRow[]>(
            'SELECT * FROM article_cover_uploads WHERE id = ? FOR UPDATE',
            [candidate.imageId]
          );
          const asset = await lockEditorialMediaAsset(
            manager,
            'article',
            candidate.imageId
          );
          const [row] = await manager.query<ArticleCoverCleanupRow[]>(
            'SELECT * FROM article_cover_cleanup WHERE imageId = ? FOR UPDATE',
            [candidate.imageId]
          );
          if (!row)
            throw new ArticleCoverUnavailableError(
              'Image cleanup intent is missing'
            );
          validateArticleCoverCleanup(row);
          if (
            row.completedAt !== null ||
            row.failedAt !== null ||
            Number(row.availableAt) > at ||
            (row.leaseUntil !== null && Number(row.leaseUntil) > at)
          )
            return null;
          const conflict =
            editorialRetirementConflict(asset, Number(row.createdAt), image) ||
            (await articleCoverReferenced(manager, candidate.imageId));
          if (conflict || row.attempts >= ARTICLE_COVER_CLEANUP_ATTEMPTS) {
            await manager.query(
              'UPDATE article_cover_cleanup SET failedAt = ?, leaseToken = NULL, leaseUntil = NULL, lastError = ? WHERE imageId = ?',
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
            'UPDATE article_cover_cleanup SET attempts = attempts + 1, leaseToken = ?, leaseUntil = ? WHERE imageId = ?',
            [token, at + ARTICLE_COVER_CLEANUP_LEASE_MS, candidate.imageId]
          );
          return { imageId: candidate.imageId, token };
        }
      );
      if (lease) return lease;
    }
    return null;
  }
  async complete(lease: ArticleCoverCleanupLease, at: number) {
    validateLease(lease, at);
    const result: { affectedRows: number } = await this.source.query(
      'UPDATE article_cover_cleanup SET completedAt = ?, leaseToken = NULL, leaseUntil = NULL, lastError = NULL WHERE imageId = ? AND leaseToken = ? AND leaseUntil > ? AND leaseUntil - ? <= ? AND completedAt IS NULL AND failedAt IS NULL',
      [at, lease.imageId, lease.token, at, ARTICLE_COVER_CLEANUP_LEASE_MS, at]
    );
    return result.affectedRows === 1;
  }
  async fail(lease: ArticleCoverCleanupLease, at: number) {
    validateLease(lease, at);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const [row] = await manager.query<ArticleCoverCleanupRow[]>(
        'SELECT * FROM article_cover_cleanup WHERE imageId = ? FOR UPDATE',
        [lease.imageId]
      );
      if (
        !row ||
        row.leaseToken !== lease.token ||
        row.leaseUntil === null ||
        Number(row.leaseUntil) <= at ||
        Number(row.leaseUntil) - ARTICLE_COVER_CLEANUP_LEASE_MS > at ||
        row.completedAt !== null ||
        row.failedAt !== null
      )
        return 'stale' as const;
      validateArticleCoverCleanup(row);
      const failed = row.attempts >= ARTICLE_COVER_CLEANUP_ATTEMPTS;
      await manager.query(
        'UPDATE article_cover_cleanup SET availableAt = ?, failedAt = ?, lastError = ?, leaseToken = NULL, leaseUntil = NULL WHERE imageId = ?',
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
        "SELECT CASE WHEN completedAt IS NOT NULL THEN 'completed' WHEN failedAt IS NOT NULL THEN 'failed' WHEN leaseToken IS NOT NULL THEN 'leased' ELSE 'pending' END AS status, COUNT(*) AS total FROM article_cover_cleanup GROUP BY status"
      ),
      failures: await manager.query(
        'SELECT imageId, reason, attempts, failedAt, lastError FROM article_cover_cleanup WHERE failedAt IS NOT NULL ORDER BY failedAt, imageId LIMIT 20'
      ),
    }));
  }
  async requeue(id: string, at: number) {
    articleCoverId(id);
    articleCoverInteger(at, 8_640_000_000_000_000);
    const result: { affectedRows: number } = await this.source.query(
      'UPDATE article_cover_cleanup SET attempts = 0, failedAt = NULL, lastError = NULL, availableAt = ? WHERE imageId = ? AND failedAt IS NOT NULL AND failedAt <= ? AND completedAt IS NULL AND leaseToken IS NULL AND leaseUntil IS NULL',
      [at, id, at]
    );
    return result.affectedRows === 1;
  }
}

function validateLease(lease: ArticleCoverCleanupLease, at: number) {
  articleCoverId(lease.imageId);
  articleCoverInteger(at, 8_640_000_000_000_000);
  if (!/^[a-f0-9]{64}$/.test(lease.token))
    throw new ArticleCoverUnavailableError('Invalid image cleanup lease');
}
