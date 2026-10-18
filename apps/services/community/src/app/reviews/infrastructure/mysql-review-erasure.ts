import type { DataSource, EntityManager } from 'typeorm';
import {
  isCanonicalIdentityId,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import { reviewContent, reviewId } from '@sdk/features/review/core';
import type { ReviewErasure } from '../application/review-erasure.port';
import { lockDiscussionErasure } from '../../discussions/infrastructure/mysql-discussion-contribution-erasure';

type Row = Record<string, unknown>;
const batch = 128;
function positive(value: unknown): number {
  const number =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1)
    throw new Error('Invalid review erasure authority integer');
  return number;
}
interface LockedReview {
  row: Row;
  id: string;
  tenantId: string;
  applicationId: string;
  revision: number;
  applicationRevision: number;
}

export class MysqlReviewErasure implements ReviewErasure {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  advance(input: AccountErasureRequest): Promise<'pending' | 'drained'> {
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const request = await lockDiscussionErasure(tx, input);
      const [owned]: Row[] = await tx.query(
        'SELECT id FROM member_reviews WHERE ownerId=? ORDER BY id LIMIT 1',
        [request.identityId]
      );
      if (owned) {
        const current = await this.lock(tx, reviewId(owned.id));
        await this.anonymize(tx, request, current);
        return 'pending';
      }
      const [target]: Row[] = await tx.query(
        'SELECT * FROM review_erasure_targets WHERE identityId=? ORDER BY reviewId LIMIT 1',
        [request.identityId]
      );
      if (target) {
        const current = await this.lock(tx, reviewId(target.reviewId));
        await this.history(tx, request, current, target);
        return 'pending';
      }
      for (const table of ['review_helpful', 'review_reports']) {
        const [interaction]: Row[] = await tx.query(
          `SELECT reviewId FROM ${table} WHERE actorId=? ORDER BY ${
            table === 'review_helpful' ? 'reviewId' : 'id'
          } LIMIT 1`,
          [request.identityId]
        );
        if (interaction) {
          const current = await this.lock(tx, reviewId(interaction.reviewId));
          await tx.query(
            'DELETE FROM review_helpful WHERE reviewId=? AND actorId=?',
            [current.id, request.identityId]
          );
          await tx.query(
            `DELETE FROM review_reports WHERE reviewId=? AND actorId=? ORDER BY contentRevision LIMIT ${batch}`,
            [current.id, request.identityId]
          );
          await this.bump(tx, current);
          return 'pending';
        }
      }
      const [command]: Row[] = await tx.query(
        'SELECT commandKey FROM review_commands WHERE actorId=? ORDER BY tenantId,applicationId,commandKey LIMIT 1',
        [request.identityId]
      );
      if (command) {
        await tx.query(
          `DELETE FROM review_commands WHERE actorId=? ORDER BY tenantId,applicationId,commandKey LIMIT ${batch}`,
          [request.identityId]
        );
        return 'pending';
      }
      const [event]: Row[] = await tx.query(
        'SELECT * FROM review_events WHERE actorId=? ORDER BY reviewId,revision LIMIT 1',
        [request.identityId]
      );
      if (event) {
        const current = await this.lock(tx, reviewId(event.reviewId));
        await this.audit(tx, request, current, event);
        return 'pending';
      }
      return 'drained';
    });
  }

  private async lock(tx: EntityManager, id: string): Promise<LockedReview> {
    const [scope]: Row[] = await tx.query(
      'SELECT tenantId,applicationId FROM member_reviews WHERE id=?',
      [id]
    );
    if (!scope || !isCanonicalIdentityId(scope.tenantId))
      throw new Error('Missing review erasure scope');
    const tenantId = scope.tenantId,
      applicationId = reviewId(scope.applicationId);
    const [application]: Row[] = await tx.query(
      'SELECT revision FROM review_applications WHERE tenantId=? AND applicationId=? FOR UPDATE',
      [tenantId, applicationId]
    );
    const [row]: Row[] = await tx.query(
      'SELECT * FROM member_reviews WHERE id=? FOR UPDATE',
      [id]
    );
    if (
      !application ||
      !row ||
      row.tenantId !== tenantId ||
      row.applicationId !== applicationId
    )
      throw new Error('Missing or changed review erasure authority');
    const revision = positive(row.revision),
      applicationRevision = positive(application.revision);
    if (
      revision >= Number.MAX_SAFE_INTEGER ||
      applicationRevision >= Number.MAX_SAFE_INTEGER
    )
      throw new Error('Review erasure revision limit reached');
    return { row, id, tenantId, applicationId, revision, applicationRevision };
  }

  private async bump(tx: EntityManager, current: LockedReview): Promise<void> {
    await tx.query('UPDATE member_reviews SET revision=? WHERE id=?', [
      current.revision + 1,
      current.id,
    ]);
    await tx.query(
      'UPDATE review_applications SET revision=? WHERE tenantId=? AND applicationId=?',
      [current.applicationRevision + 1, current.tenantId, current.applicationId]
    );
  }

  private async anonymize(
    tx: EntityManager,
    request: AccountErasureRequest,
    current: LockedReview
  ): Promise<void> {
    const { row, id, revision } = current;
    if (
      row.ownerId !== request.identityId ||
      row.erasedAt !== null ||
      ![0, 1].includes(Number(row.withdrawn)) ||
      ![0, 1].includes(Number(row.hidden))
    )
      throw new Error('Invalid review erasure owner or state');
    const contentRevision = positive(row.contentRevision);
    if (contentRevision > revision)
      throw new Error('Invalid review erasure content revision');
    const [stored]: Row[] = await tx.query(
      'SELECT displayName,rating,text FROM review_versions WHERE reviewId=? AND revision=?',
      [id, contentRevision]
    );
    if (!stored) throw new Error('Missing current review version');
    const content = reviewContent(stored);
    const createdAt = positive(row.createdAt),
      updatedAt = positive(row.updatedAt);
    if (updatedAt < createdAt)
      throw new Error('Invalid review erasure chronology');
    const at = Math.max(positive(this.now()), updatedAt);
    const retain = Number(row.withdrawn) === 0 && Number(row.hidden) === 0;
    if (retain) {
      await tx.query(
        'INSERT INTO review_versions (reviewId,revision,displayName,rating,text) VALUES (?,?,?,?,?)',
        [id, revision + 1, 'Deleted account', content.rating, content.text]
      );
    }
    await tx.query(
      'UPDATE member_reviews SET revision=?,ownerId=NULL,contentRevision=?,withdrawn=?,moderationReason=NULL,erasedAt=?,updatedAt=? WHERE id=?',
      [
        revision + 1,
        retain ? revision + 1 : null,
        retain ? 0 : 1,
        retain ? null : at,
        at,
        id,
      ]
    );
    await this.bump(tx, current);
    await tx.query(
      'INSERT INTO review_erasure_targets (identityId,erasureRevision,reviewId,cutoffRevision) VALUES (?,?,?,?)',
      [request.identityId, request.revision, id, revision]
    );
  }

  private async history(
    tx: EntityManager,
    request: AccountErasureRequest,
    current: LockedReview,
    target: Row
  ): Promise<void> {
    const cutoff = positive(target.cutoffRevision);
    if (
      positive(target.erasureRevision) !== request.revision ||
      cutoff >= current.revision ||
      current.row.ownerId !== null ||
      (current.row.erasedAt === null &&
        positive(current.row.contentRevision) <= cutoff)
    )
      throw new Error('Invalid review erasure history target');
    // Historical reports disappear before their immutable versions and resolution provenance.
    for (const [table, column, order] of [
      ['review_reports', 'contentRevision', 'contentRevision,id'],
      ['review_commands', 'revision', 'revision'],
      ['review_events', 'revision', 'revision'],
      ['review_versions', 'revision', 'revision'],
    ]) {
      const rows: Row[] = await tx.query(
        `SELECT 1 FROM ${table} WHERE reviewId=? AND ${column}<=? LIMIT 1`,
        [current.id, cutoff]
      );
      if (rows.length) {
        await tx.query(
          `DELETE FROM ${table} WHERE reviewId=? AND ${column}<=? ORDER BY ${order} LIMIT ${batch}`,
          [current.id, cutoff]
        );
        return;
      }
    }
    if (current.row.erasedAt !== null) {
      const helpful: Row[] = await tx.query(
        'SELECT 1 FROM review_helpful WHERE reviewId=? LIMIT 1',
        [current.id]
      );
      if (helpful.length) {
        await tx.query(
          `DELETE FROM review_helpful WHERE reviewId=? ORDER BY actorId LIMIT ${batch}`,
          [current.id]
        );
        return;
      }
    }
    await tx.query(
      'DELETE FROM review_erasure_targets WHERE identityId=? AND reviewId=? AND erasureRevision=?',
      [request.identityId, current.id, request.revision]
    );
  }

  private async audit(
    tx: EntityManager,
    request: AccountErasureRequest,
    current: LockedReview,
    event: Row
  ): Promise<void> {
    const revision = positive(event.revision);
    if (
      revision > current.revision ||
      event.tenantId !== current.tenantId ||
      event.applicationId !== current.applicationId
    )
      throw new Error('Invalid review erasure audit scope');
    let changed = false;
    if (event.type === 'moderate') {
      const [latest]: Row[] = await tx.query(
        "SELECT actorId,reason FROM review_events WHERE reviewId=? AND type='moderate' ORDER BY revision DESC LIMIT 1",
        [current.id]
      );
      if (
        latest?.actorId === request.identityId &&
        current.row.moderationReason !== null
      ) {
        if (current.row.moderationReason !== latest.reason)
          throw new Error('Review moderation provenance differs');
        await tx.query(
          'UPDATE member_reviews SET moderationReason=NULL WHERE id=?',
          [current.id]
        );
        changed = true;
      }
      const resolved: Row[] = await tx.query(
        `SELECT id,resolvedAt,resolutionReason FROM review_reports WHERE reviewId=? AND resolutionRevision=? AND resolutionReason IS NOT NULL ORDER BY id LIMIT ${batch}`,
        [current.id, revision]
      );
      for (const report of resolved) {
        if (
          positive(report.resolvedAt) !== positive(event.createdAt) ||
          report.resolutionReason !== event.reason
        )
          throw new Error('Review resolution provenance differs');
        await tx.query(
          'UPDATE review_reports SET resolutionReason=NULL WHERE id=?',
          [reviewId(report.id)]
        );
      }
      if (resolved.length || changed) await this.bump(tx, current);
      if (resolved.length) return;
    }
    await tx.query(
      'DELETE FROM review_events WHERE reviewId=? AND revision=? AND actorId=?',
      [current.id, revision, request.identityId]
    );
  }
}
