import { lockIdentityWrites } from '@sdk/extras/identity-mysql';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import { randomUUID } from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import {
  reviewContent,
  reviewCursor,
  reviewId,
  reviewSummary,
  ReviewConflictError,
  ReviewMissingError,
  ReviewInputError,
  type MemberReview,
  type ReviewPage,
  type ReviewReportPage,
  type ReviewReport,
} from '@sdk/features/review/core';
import type {
  ReviewCommand,
  ReviewReader,
  ReviewRecord,
  ReviewScope,
  ReviewSnapshot,
  ReviewsRepository,
  ReviewTransaction,
} from '../application/reviews.port';

type Row = Record<string, unknown>;
const scopeValues = (scope: ReviewScope) => [
  scope.tenantId,
  scope.applicationId,
];
const scopeWhere = 'r.tenantId=? AND r.applicationId=? AND r.erasedAt IS NULL';
const contentJoin =
  'LEFT JOIN review_versions v ON v.reviewId=r.id AND v.revision=r.contentRevision';
const contentSelect = 'r.*, v.displayName, v.rating, v.text';
const positive = (value: unknown, minimum = 1) => {
  if (
    typeof value !== 'number' &&
    !(typeof value === 'string' && /^[0-9]+$/.test(value))
  )
    throw new Error('Missing canonical review number');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum)
    throw new Error('Invalid canonical review number');
  return number;
};
function boolean(value: unknown): boolean {
  if (value !== 0 && value !== 1 && value !== '0' && value !== '1')
    throw new Error('Invalid canonical review boolean');
  return value === 1 || value === '1';
}
function record(row: Row): ReviewRecord {
  if (row['ownerId'] !== null && !isCanonicalIdentityId(row['ownerId']))
    throw new Error('Missing review author');
  if (row['ownerId'] === null && row['displayName'] !== 'Deleted account')
    throw new Error('Invalid anonymous review attribution');
  if (
    row['moderationReason'] !== null &&
    typeof row['moderationReason'] !== 'string'
  )
    throw new Error('Invalid review moderation reason');
  const revision = positive(row['revision']);
  const contentRevision = positive(row['contentRevision']);
  const createdAt = positive(row['createdAt']);
  const updatedAt = positive(row['updatedAt']);
  if (contentRevision > revision || updatedAt < createdAt)
    throw new Error('Invalid canonical review revisions');
  return {
    id: reviewId(row['id']),
    ownerId: row['ownerId'],
    revision,
    contentRevision,
    withdrawn: boolean(row['withdrawn']),
    hidden: boolean(row['hidden']),
    moderationReason: row['moderationReason'],
    createdAt,
    updatedAt,
    content: reviewContent({
      displayName: row['displayName'],
      rating: row['rating'],
      text: row['text'],
    }),
  };
}
function cursorSql(
  cursor: string | null,
  alias: string
): { sql: string; values: unknown[] } {
  const point = reviewCursor(cursor);
  return point
    ? {
        sql: `AND (${alias}.createdAt < ? OR (${alias}.createdAt = ? AND ${alias}.id > ?))`,
        values: [point.at, point.at, point.id],
      }
    : { sql: '', values: [] };
}
function nextCursor(rows: Row[]): string | null {
  return rows.length > 10
    ? `${positive(rows[9]['createdAt'])}.${reviewId(rows[9]['id'])}`
    : null;
}

export class MysqlReviews implements ReviewsRepository {
  constructor(private readonly source: DataSource) {}

  async transaction<T>(
    scope: ReviewScope,
    actorId: string,
    work: (tx: ReviewTransaction) => Promise<T>,
    id: string | null = null
  ): Promise<T> {
    const runner = this.source.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction('READ COMMITTED');
      const [author]: Row[] =
        id === null
          ? []
          : await runner.query(
              'SELECT ownerId FROM member_reviews WHERE id=? AND tenantId=? AND applicationId=?',
              [reviewId(id), ...scopeValues(scope)]
            );
      const owner = author?.['ownerId'];
      if (
        owner !== undefined &&
        owner !== null &&
        !isCanonicalIdentityId(owner)
      )
        throw new Error('Invalid review owner');
      // Author lookup precedes all locks; ownership can only transition to null.
      await lockIdentityWrites(runner.manager, [
        actorId,
        ...(typeof owner === 'string' ? [owner] : []),
      ]);
      await runner.query(
        `INSERT INTO review_applications (tenantId, applicationId, revision) VALUES (?, ?, 0)
        ON DUPLICATE KEY UPDATE applicationId=VALUES(applicationId)`,
        scopeValues(scope)
      );
      const rows = await runner.query(
        'SELECT revision FROM review_applications WHERE tenantId=? AND applicationId=? FOR UPDATE',
        scopeValues(scope)
      );
      if (
        rows.length !== 1 ||
        positive(rows[0].revision, 0) >= Number.MAX_SAFE_INTEGER
      )
        throw new ReviewConflictError(
          'Review application revision limit reached'
        );
      if (Number(rows[0].revision) === 0) await this.assertEmpty(runner, scope);
      const value = await work(new MysqlReviewTransaction(runner, scope));
      await runner.commitTransaction();
      return value;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      if (error instanceof ReviewInputError)
        throw new Error('Invalid canonical review authority');
      throw error;
    } finally {
      await runner.release();
    }
  }

  async revision(scope: ReviewScope): Promise<number> {
    const rows = await this.source.query(
      'SELECT revision FROM review_applications WHERE tenantId=? AND applicationId=?',
      scopeValues(scope)
    );
    return rows.length ? positive(rows[0].revision, 0) : 0;
  }

  page(
    scope: ReviewScope,
    reader: ReviewReader,
    cursor: string | null,
    moderation: boolean
  ): Promise<ReviewSnapshot<ReviewPage>> {
    return this.snapshot(scope, async (runner) => {
      if (moderation && !reader.moderator)
        throw new Error('Moderation reader is required');
      const point = cursorSql(cursor, 'r');
      const rows = await this.rows(
        runner,
        scope,
        reader,
        `${moderation ? '' : 'AND r.hidden=0 AND r.withdrawn=0'} ${point.sql}`,
        point.values
      );
      const own = reader.actorId
        ? await this.rows(runner, scope, reader, 'AND r.ownerId=?', [
            reader.actorId,
          ])
        : [];
      const summary = await this.aggregate(runner, scope);
      return {
        items: rows.slice(0, 10).map((row) => this.present(row, scope, reader)),
        next: nextCursor(rows),
        mine: own.length ? this.present(own[0], scope, reader) : null,
        summary,
        canModerate: reader.moderator,
      };
    });
  }

  summary(scope: ReviewScope): Promise<ReviewSnapshot<ReviewPage['summary']>> {
    return this.snapshot(scope, (runner) => this.aggregate(runner, scope));
  }

  private async aggregate(
    runner: QueryRunner,
    scope: ReviewScope
  ): Promise<ReviewPage['summary']> {
    const bins: { rating: number; count: string | number }[] =
      await runner.query(
        `SELECT v.rating, COUNT(*) AS count FROM member_reviews r ${contentJoin}
         WHERE ${scopeWhere} AND r.hidden=0 AND r.withdrawn=0 GROUP BY v.rating`,
        scopeValues(scope)
      );
    const distribution: ReviewPage['summary']['distribution'] = [0, 0, 0, 0, 0];
    for (const bin of bins) {
      const rating = positive(bin.rating);
      if (rating > 5) throw new Error('Invalid canonical review rating');
      distribution[rating - 1] = positive(bin.count, 0);
    }
    const total = distribution.reduce((sum, count) => sum + count, 0);
    const average = total
      ? distribution.reduce((sum, count, i) => sum + count * (i + 1), 0) / total
      : null;
    return reviewSummary({ total, average, distribution });
  }

  read(
    scope: ReviewScope,
    reader: ReviewReader,
    id: string
  ): Promise<ReviewSnapshot<MemberReview | null>> {
    return this.snapshot(scope, async (runner) => {
      const rows = await this.rows(
        runner,
        scope,
        reader,
        'AND r.id=? AND ((r.hidden=0 AND r.withdrawn=0) OR r.ownerId=? OR ?=1)',
        [id, reader.actorId, reader.moderator ? 1 : 0]
      );
      return rows.length ? this.present(rows[0], scope, reader) : null;
    });
  }

  reports(
    scope: ReviewScope,
    id: string,
    cursor: string | null
  ): Promise<ReviewSnapshot<ReviewReportPage>> {
    return this.snapshot(scope, async (runner) => {
      const exists = await runner.query(
        `SELECT id FROM member_reviews r WHERE ${scopeWhere} AND r.id=?`,
        [...scopeValues(scope), id]
      );
      if (!exists.length) throw new ReviewMissingError('Review not found');
      const point = cursorSql(cursor, 'p');
      const rows: Row[] = await runner.query(
        `SELECT p.*, v.displayName, v.rating, v.text FROM review_reports p
        JOIN member_reviews r ON r.id=p.reviewId
        LEFT JOIN review_versions v ON v.reviewId=p.reviewId AND v.revision=p.contentRevision
        WHERE p.reviewId=? AND r.erasedAt IS NULL AND (r.ownerId IS NOT NULL OR p.contentRevision=r.contentRevision) ${point.sql} ORDER BY p.createdAt DESC, p.id ASC LIMIT 11`,
        [id, ...point.values]
      );
      return {
        next: nextCursor(rows),
        items: rows.slice(0, 10).map((row): ReviewReport => {
          const resolution = row['resolution'];
          if (
            resolution !== 'open' &&
            resolution !== 'dismissed' &&
            resolution !== 'hidden'
          )
            throw new Error('Invalid report resolution');
          if (typeof row['reason'] !== 'string')
            throw new Error('Missing report reason');
          return {
            id: reviewId(row['id']),
            reason: row['reason'],
            createdAt: positive(row['createdAt']),
            contentRevision: positive(row['contentRevision']),
            resolution,
            content: reviewContent({
              displayName: row['displayName'],
              rating: row['rating'],
              text: row['text'],
            }),
          };
        }),
      };
    });
  }

  private async snapshot<T>(
    scope: ReviewScope,
    read: (runner: QueryRunner) => Promise<T>
  ): Promise<ReviewSnapshot<T>> {
    const runner = this.source.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction('REPEATABLE READ');
      // The first nonlocking read anchors every row/count in the same InnoDB snapshot.
      const rows = await runner.query(
        'SELECT revision FROM review_applications WHERE tenantId=? AND applicationId=?',
        scopeValues(scope)
      );
      const revision = rows.length ? positive(rows[0].revision, 0) : 0;
      if (revision === 0) await this.assertEmpty(runner, scope);
      const value = await read(runner);
      await runner.commitTransaction();
      return { value, revision };
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      if (error instanceof ReviewInputError)
        throw new Error('Invalid canonical review authority');
      throw error;
    } finally {
      await runner.release();
    }
  }

  private rows(
    runner: QueryRunner,
    scope: ReviewScope,
    reader: ReviewReader,
    filter: string,
    values: unknown[]
  ): Promise<Row[]> {
    return runner.query(
      `SELECT ${contentSelect},
      (SELECT COUNT(*) FROM review_helpful h WHERE h.reviewId=r.id) AS helpfulCount,
      EXISTS(SELECT 1 FROM review_helpful h WHERE h.reviewId=r.id AND h.actorId=?) AS helpful,
      EXISTS(SELECT 1 FROM review_reports p WHERE p.reviewId=r.id AND p.actorId=? AND p.contentRevision=r.contentRevision) AS reported,
      (SELECT COUNT(*) FROM review_reports p WHERE p.reviewId=r.id AND p.resolution='open' AND (r.ownerId IS NOT NULL OR p.contentRevision=r.contentRevision)) AS openReports
      FROM member_reviews r ${contentJoin} WHERE ${scopeWhere} ${filter}
      ORDER BY r.createdAt DESC, r.id ASC LIMIT 11`,
      [reader.actorId, reader.actorId, ...scopeValues(scope), ...values]
    );
  }

  private async assertEmpty(runner: QueryRunner, scope: ReviewScope) {
    const rows = await runner.query(
      'SELECT id FROM member_reviews WHERE tenantId=? AND applicationId=? LIMIT 1',
      scopeValues(scope)
    );
    if (rows.length) throw new Error('Review application authority is missing');
  }

  private present(
    row: Row,
    scope: ReviewScope,
    reader: ReviewReader
  ): MemberReview {
    const { ownerId, ...review } = record(row);
    const mine = reader.actorId !== null && ownerId === reader.actorId;
    return {
      ...review,
      moderationReason:
        mine || reader.moderator ? review.moderationReason : null,
      applicationId: scope.applicationId,
      helpfulCount: positive(row['helpfulCount'], 0),
      helpful: boolean(row['helpful']),
      reported: boolean(row['reported']),
      mine,
      canModerate: reader.moderator && !mine,
      openReports: reader.moderator ? positive(row['openReports'], 0) : null,
    };
  }
}

class MysqlReviewTransaction implements ReviewTransaction {
  constructor(
    private readonly runner: QueryRunner,
    private readonly scope: ReviewScope
  ) {}

  async receipt(command: ReviewCommand) {
    const rows = await this.runner.query(
      `SELECT fingerprint, reviewId, revision FROM review_commands
      WHERE tenantId=? AND applicationId=? AND actorId=? AND commandKey=?`,
      [...scopeValues(this.scope), command.actorId, command.key]
    );
    if (!rows.length) return null;
    if (rows[0].fingerprint !== command.fingerprint)
      throw new ReviewConflictError(
        'Idempotency key belongs to a different command'
      );
    return {
      id: reviewId(rows[0].reviewId),
      revision: positive(rows[0].revision),
    };
  }

  own(actorId: string) {
    return this.findBy('ownerId', actorId);
  }
  find(id: string) {
    return this.findBy('id', id);
  }
  private async findBy(
    column: 'id' | 'ownerId',
    value: string
  ): Promise<ReviewRecord | null> {
    const rows: Row[] = await this.runner.query(
      `SELECT ${contentSelect} FROM member_reviews r ${contentJoin}
      WHERE ${scopeWhere} AND r.${column}=?`,
      [...scopeValues(this.scope), value]
    );
    return rows.length ? record(rows[0]) : null;
  }

  async commit(input: Parameters<ReviewTransaction['commit']>[0]) {
    const { record: review, change, command, at } = input;
    const { id } = review;
    if (change.type === 'report') {
      const existing = await this.runner.query(
        'SELECT id FROM review_reports WHERE reviewId=? AND actorId=? AND contentRevision=?',
        [id, command.actorId, review.contentRevision]
      );
      if (existing.length)
        throw new ReviewConflictError(
          'You already reported this version of the review'
        );
      await this.runner.query(
        `INSERT INTO review_reports (id, reviewId, actorId, contentRevision, reason, createdAt, resolution, resolvedAt, resolutionReason)
        VALUES (?, ?, ?, ?, ?, ?, 'open', NULL, NULL)`,
        [
          randomUUID(),
          id,
          command.actorId,
          review.contentRevision,
          change.reason,
          at,
        ]
      );
    }
    if (change.type === 'publish')
      await this.runner.query(
        `INSERT INTO review_versions (reviewId, revision, displayName, rating, text) VALUES (?, ?, ?, ?, ?)`,
        [
          id,
          review.contentRevision,
          review.content.displayName,
          review.content.rating,
          review.content.text,
        ]
      );
    if (change.expectedRevision === 0) {
      await this.runner.query(
        `INSERT INTO member_reviews
        (id, tenantId, applicationId, ownerId, revision, contentRevision, withdrawn, hidden, moderationReason, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ...scopeValues(this.scope),
          review.ownerId,
          review.revision,
          review.contentRevision,
          review.withdrawn ? 1 : 0,
          review.hidden ? 1 : 0,
          review.moderationReason,
          review.createdAt,
          review.updatedAt,
        ]
      );
    } else {
      const result = await this.runner.query(
        `UPDATE member_reviews SET revision=?, contentRevision=?, withdrawn=?, hidden=?, moderationReason=?, updatedAt=?
        WHERE id=? AND tenantId=? AND applicationId=? AND revision=?`,
        [
          review.revision,
          review.contentRevision,
          review.withdrawn ? 1 : 0,
          review.hidden ? 1 : 0,
          review.moderationReason,
          review.updatedAt,
          id,
          ...scopeValues(this.scope),
          change.expectedRevision,
        ]
      );
      if (result.affectedRows !== 1)
        throw new ReviewConflictError('Review changed while saving');
    }
    if (change.type === 'helpful') {
      if (change.helpful)
        await this.runner.query(
          `INSERT INTO review_helpful (reviewId, actorId, createdAt) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE actorId=VALUES(actorId)`,
          [id, command.actorId, at]
        );
      else
        await this.runner.query(
          'DELETE FROM review_helpful WHERE reviewId=? AND actorId=?',
          [id, command.actorId]
        );
    }
    if (change.type === 'moderate')
      await this.runner.query(
        `UPDATE review_reports SET resolution=?, resolvedAt=?, resolutionReason=?, resolutionRevision=?
      WHERE reviewId=? AND resolution='open' AND (?=1 OR contentRevision=?)`,
        [
          change.hidden ? 'hidden' : 'dismissed',
          at,
          change.reason,
          review.revision,
          id,
          review.ownerId === null ? 0 : 1,
          review.contentRevision,
        ]
      );
    await this.runner.query(
      `INSERT INTO review_commands (tenantId, applicationId, actorId, commandKey, fingerprint, reviewId, revision, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ...scopeValues(this.scope),
        command.actorId,
        command.key,
        command.fingerprint,
        id,
        review.revision,
        at,
      ]
    );
    await this.runner.query(
      `INSERT INTO review_events (reviewId, revision, tenantId, applicationId, contentRevision, actorId, type, reason, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        review.revision,
        ...scopeValues(this.scope),
        review.contentRevision,
        command.actorId,
        change.type,
        'reason' in change ? change.reason : null,
        at,
      ]
    );
    await this.runner.query(
      'UPDATE review_applications SET revision=revision+1 WHERE tenantId=? AND applicationId=?',
      scopeValues(this.scope)
    );
    return { id, revision: review.revision };
  }
}
