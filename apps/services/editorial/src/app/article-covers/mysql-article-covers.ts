import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import { lockIdentityWrites } from '@wapps/account-mysql';
import { randomBytes } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  ARTICLE_COVER_UPLOAD_LIFETIME,
  ARTICLE_COVER_PENDING_LIMIT,
  ARTICLE_COVER_DAILY_LIMIT,
  ARTICLE_COVER_RETAINED_LIMIT,
  ARTICLE_COVER_ATTEMPT_LIMIT,
  ArticleCoverConflictError,
  ArticleCoverInputError,
  ArticleCoverNotFoundError,
  ArticleCoverRateLimitError,
  ArticleCoverUnavailableError,
  assertArticleCoverUploadWritable,
  assertArticleCoverCancellation,
  parseArticleCoverAsset,
  parseArticleCoverUpload,
  parseArticleCoverUploadReceipt,
  type ArticleCoverAsset,
  type ArticleCoverUploadReceipt,
} from '@domains/catalog/media';
import type { EditorialActor } from '../application/editorial.ports';
import type {
  ArticleCoverCommand,
  ArticleCoverContentCommand,
  ArticleCoverCreateCommand,
  ArticleCoverCancelCommand,
  ArticleCoverReservation,
  ArticleCoverStore,
} from './article-cover.ports';
import {
  articleCoverReferenced,
  retireArticleCover,
} from './article-cover-retirement';
import { recordEditorialMediaAsset } from '../application-media/editorial-media-assets';

export const ARTICLE_COVER_LEASE_MS = 30_000;
export const ARTICLE_COVER_COMMAND_ATTEMPTS = 3;
export interface ArticleCoverRow extends Record<string, unknown> {
  id: string;
  tenantId: string;
  ownerIdentityId: string;
  articleId: string;
  leaseToken: string | null;
  leaseUntil: string | number | null;
  commandKey: string | null;
  attempts: number;
  draftDeletedAt?: string | number | null;
}
interface CommandRow {
  imageId: string;
  fingerprint: string;
  receipt: unknown;
  executions: number;
}
export function articleCoverFromRow(row: ArticleCoverRow) {
  try {
    return parseArticleCoverUpload({
      id: row.id,
      articleId: row.articleId,
      source: {
        contentType: row.sourceType,
        bytes: Number(row.sourceBytes),
        sha256: row.sourceSha256,
      },
      status: row.status,
      revision: Number(row.revision),
      createdAt: Number(row.createdAt),
      expiresAt: Number(row.expiresAt),
      asset: typeof row.asset === 'string' ? JSON.parse(row.asset) : row.asset,
    });
  } catch {
    throw new ArticleCoverUnavailableError('Stored article cover is invalid');
  }
}

/** Private uploads share the draft owner's lock; object I/O never runs inside these transactions. */
export class MysqlArticleCovers implements ArticleCoverStore {
  constructor(private readonly source: DataSource) {}
  async list(actor: EditorialActor, articleId: string, at: number) {
    return this.guard(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const drafts = await manager.query(
          'SELECT id FROM article_drafts WHERE id = ? AND tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL',
          [articleId, actor.tenantId, actor.identityId]
        );
        if (drafts.length !== 1)
          throw new ArticleCoverNotFoundError('Article draft not found');
        const rows = await manager.query<ArticleCoverRow[]>(
          "SELECT * FROM article_cover_uploads WHERE articleId = ? AND tenantId = ? AND ownerIdentityId = ? AND (status = 'ready' OR (status = 'pending' AND expiresAt > ?)) ORDER BY createdAt DESC, id LIMIT ?",
          [
            articleId,
            actor.tenantId,
            actor.identityId,
            at,
            ARTICLE_COVER_RETAINED_LIMIT + 1,
          ]
        );
        if (rows.length > ARTICLE_COVER_RETAINED_LIMIT)
          throw new ArticleCoverUnavailableError(
            'Image upload capacity is invalid'
          );
        return rows.map(articleCoverFromRow);
      })
    );
  }
  async cancel(command: ArticleCoverCancelCommand) {
    return this.write(command.actor, async (manager) => {
      const row = await this.row(manager, command.actor, command.id, true);
      const prior = await this.command(manager, command);
      if (prior) return this.receipt(prior);
      this.assertLiveDraft(row);
      const upload = articleCoverFromRow(row);
      assertArticleCoverCancellation(
        upload,
        command.expectedRevision,
        await articleCoverReferenced(manager, upload.id)
      );
      const receipt = await retireArticleCover(
        manager,
        upload.id,
        upload.revision,
        command.at,
        'cancelled'
      );
      await this.insertCommand(manager, command, receipt);
      return receipt;
    });
  }
  async create(command: ArticleCoverCreateCommand) {
    return this.write(command.actor, async (manager) => {
      const prior = await this.command(manager, command);
      if (prior) {
        await this.row(manager, command.actor, prior.imageId);
        return this.receipt(prior);
      }
      const { actor, input, id, at } = command;
      const [draft] = await manager.query<{ id: string }[]>(
        'SELECT id FROM article_drafts WHERE id = ? AND tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL',
        [input.articleId, actor.tenantId, actor.identityId]
      );
      if (!draft)
        throw new ArticleCoverNotFoundError('Article draft not found');
      const [count] = await manager.query<
        {
          pending: string | number;
          recent: string | number;
          retained: string | number;
        }[]
      >(
        `SELECT COALESCE(SUM(status = 'pending' AND expiresAt > ?), 0) AS pending,
          COALESCE(SUM(createdAt > ?), 0) AS recent,
          COALESCE(SUM(status = 'ready' OR (status = 'pending' AND expiresAt > ?)), 0) AS retained
        FROM article_cover_uploads WHERE tenantId = ? AND ownerIdentityId = ?`,
        [
          at,
          at - ARTICLE_COVER_UPLOAD_LIFETIME,
          at,
          actor.tenantId,
          actor.identityId,
        ]
      );
      if (
        Number(count.pending) >= ARTICLE_COVER_PENDING_LIMIT ||
        Number(count.recent) >= ARTICLE_COVER_DAILY_LIMIT ||
        Number(count.retained) >= ARTICLE_COVER_RETAINED_LIMIT
      )
        throw new ArticleCoverRateLimitError(
          'Image upload capacity reached. Remove unused images or retry after older reservations expire.'
        );
      const upload = parseArticleCoverUpload({
        ...input,
        id,
        revision: 1,
        status: 'pending',
        createdAt: at,
        expiresAt: at + ARTICLE_COVER_UPLOAD_LIFETIME,
        asset: null,
      });
      await manager.query(
        `INSERT INTO article_cover_uploads
        (id, tenantId, ownerIdentityId, articleId, sourceType, sourceBytes, sourceSha256, revision, status, createdAt, expiresAt, asset, attempts, leaseToken, leaseUntil, commandKey)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?, NULL, 0, NULL, NULL, NULL)`,
        [
          id,
          actor.tenantId,
          actor.identityId,
          input.articleId,
          input.source.contentType,
          input.source.bytes,
          input.source.sha256,
          at,
          upload.expiresAt,
        ]
      );
      const receipt = { id, revision: 1, status: 'pending' as const };
      await this.insertCommand(manager, command, receipt);
      return receipt;
    });
  }
  async read(actor: EditorialActor, id: string) {
    return this.guard(async () => {
      const row = await this.row(this.source.manager, actor, id);
      this.assertLiveDraft(row);
      return articleCoverFromRow(row);
    });
  }
  async reserve(
    command: ArticleCoverContentCommand
  ): Promise<ArticleCoverReservation> {
    return this.write(command.actor, async (manager) => {
      const row = await this.row(manager, command.actor, command.id, true);
      const prior = await this.command(manager, command);
      if (prior && prior.receipt !== null)
        return { receipt: this.receipt(prior) };
      this.assertLiveDraft(row);
      const upload = articleCoverFromRow(row);
      assertArticleCoverUploadWritable(
        upload,
        command.expectedRevision,
        command.at
      );
      this.assertSource(upload.source, command);
      if (row.leaseUntil !== null && Number(row.leaseUntil) > command.at)
        throw new ArticleCoverUnavailableError(
          'This upload is processing. Retry the same request shortly.'
        );
      if (
        row.attempts >= ARTICLE_COVER_ATTEMPT_LIMIT ||
        (prior?.executions ?? 0) >= ARTICLE_COVER_COMMAND_ATTEMPTS
      )
        throw new ArticleCoverRateLimitError(
          'Image processing retry limit reached. Create a new upload reservation.'
        );
      if (!prior) await this.insertCommand(manager, command, null);
      const lease = randomBytes(32).toString('hex');
      await manager.query(
        'UPDATE article_cover_uploads SET attempts = attempts + 1, leaseToken = ?, leaseUntil = ?, commandKey = ? WHERE id = ?',
        [
          lease,
          Math.min(command.at + ARTICLE_COVER_LEASE_MS, upload.expiresAt),
          command.key,
          command.id,
        ]
      );
      await manager.query(
        'UPDATE article_cover_commands SET executions = executions + 1 WHERE tenantId = ? AND ownerIdentityId = ? AND commandKey = ?',
        [command.actor.tenantId, command.actor.identityId, command.key]
      );
      return { upload, lease };
    });
  }
  async complete(
    command: ArticleCoverContentCommand,
    lease: string,
    value: ArticleCoverAsset,
    at: number
  ) {
    return this.write(command.actor, async (manager) => {
      const row = await this.row(manager, command.actor, command.id, true);
      const prior = await this.command(manager, command);
      if (prior && prior.receipt !== null) return this.receipt(prior);
      this.assertLiveDraft(row);
      const upload = articleCoverFromRow(row);
      assertArticleCoverUploadWritable(upload, command.expectedRevision, at);
      this.assertSource(upload.source, command);
      if (
        !prior ||
        row.leaseToken !== lease ||
        row.commandKey !== command.key ||
        row.leaseUntil === null ||
        Number(row.leaseUntil) <= at ||
        at < command.at
      )
        throw new ArticleCoverConflictError(
          'The image processing lease expired. Retry the same request.'
        );
      const asset = parseArticleCoverAsset(value);
      if (asset.id !== upload.id)
        throw new ArticleCoverInputError(
          'The normalized image does not match its reservation'
        );
      const receipt = parseArticleCoverUploadReceipt({
        id: upload.id,
        revision: upload.revision + 1,
        status: 'ready',
      });
      await recordEditorialMediaAsset(manager, {
        kind: 'article',
        imageId: upload.id,
        tenantId: command.actor.tenantId,
        articleId: upload.articleId,
        asset,
        createdAt: upload.createdAt,
        retiredAt: null,
      });
      await manager.query(
        "UPDATE article_cover_uploads SET status = 'ready', revision = ?, asset = ?, leaseToken = NULL, leaseUntil = NULL, commandKey = NULL WHERE id = ?",
        [receipt.revision, JSON.stringify(asset), upload.id]
      );
      await manager.query(
        'UPDATE article_cover_commands SET receipt = ?, completedAt = ? WHERE tenantId = ? AND ownerIdentityId = ? AND commandKey = ?',
        [
          JSON.stringify(receipt),
          at,
          command.actor.tenantId,
          command.actor.identityId,
          command.key,
        ]
      );
      return receipt;
    });
  }
  async fail(command: ArticleCoverContentCommand, lease: string, at: number) {
    return this.write(command.actor, async (manager) => {
      // A late failure cannot release a replacement worker's lease or undo an uncertain successful commit.
      await manager.query(
        "UPDATE article_cover_uploads SET leaseToken = NULL, leaseUntil = NULL, commandKey = NULL WHERE id = ? AND tenantId = ? AND ownerIdentityId = ? AND status = 'pending' AND leaseToken = ? AND commandKey = ? AND leaseUntil > ?",
        [
          command.id,
          command.actor.tenantId,
          command.actor.identityId,
          lease,
          command.key,
          at,
        ]
      );
    });
  }
  private assertSource(
    source: { bytes: number; sha256: string },
    command: ArticleCoverContentCommand
  ) {
    if (
      source.bytes !== command.sourceBytes ||
      source.sha256 !== command.sourceSha256
    )
      throw new ArticleCoverInputError(
        'Select the exact file reserved for this upload'
      );
  }
  private assertLiveDraft(row: ArticleCoverRow) {
    if (row.draftDeletedAt !== null)
      throw new ArticleCoverNotFoundError('Article draft not found');
  }
  private async row(
    manager: EntityManager,
    actor: EditorialActor,
    id: string,
    lock = false
  ) {
    const [row] = await manager.query<ArticleCoverRow[]>(
      `SELECT i.*, d.deletedAt AS draftDeletedAt FROM article_cover_uploads i
      INNER JOIN article_drafts d ON d.id = i.articleId AND d.tenantId = i.tenantId AND d.ownerIdentityId = i.ownerIdentityId
      WHERE i.id = ? AND i.tenantId = ? AND i.ownerIdentityId = ?${
        lock ? ' FOR UPDATE' : ''
      }`,
      [id, actor.tenantId, actor.identityId]
    );
    if (!row) throw new ArticleCoverNotFoundError('Article cover not found');
    return row;
  }
  private async command(manager: EntityManager, command: ArticleCoverCommand) {
    const [row] = await manager.query<CommandRow[]>(
      'SELECT imageId, fingerprint, receipt, executions FROM article_cover_commands WHERE tenantId = ? AND ownerIdentityId = ? AND commandKey = ?',
      [command.actor.tenantId, command.actor.identityId, command.key]
    );
    if (row && row.fingerprint !== command.fingerprint)
      throw new ArticleCoverConflictError(
        'Idempotency-Key was used for another command'
      );
    return row;
  }
  private receipt(row: CommandRow) {
    try {
      const receipt = parseArticleCoverUploadReceipt(
        typeof row.receipt === 'string' ? JSON.parse(row.receipt) : row.receipt
      );
      if (receipt.id !== row.imageId) throw new Error('Receipt image mismatch');
      return receipt;
    } catch {
      throw new ArticleCoverUnavailableError('Stored image receipt is invalid');
    }
  }
  private async insertCommand(
    manager: EntityManager,
    command: ArticleCoverCommand,
    receipt: ArticleCoverUploadReceipt | null
  ) {
    await manager.query(
      'INSERT INTO article_cover_commands (tenantId, ownerIdentityId, commandKey, imageId, fingerprint, receipt, executions, createdAt, completedAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
      [
        command.actor.tenantId,
        command.actor.identityId,
        command.key,
        command.id,
        command.fingerprint,
        receipt ? JSON.stringify(receipt) : null,
        command.at,
        receipt ? command.at : null,
      ]
    );
  }
  private write<T>(
    actor: EditorialActor,
    action: (manager: EntityManager) => Promise<T>
  ) {
    return this.guard(() =>
      this.source.transaction('READ COMMITTED', async (manager) => {
        await lockIdentityWrites(manager, [actor.identityId]);
        await manager.query(
          'INSERT INTO article_workspaces (tenantId, ownerIdentityId) VALUES (?, ?) ON DUPLICATE KEY UPDATE ownerIdentityId = ownerIdentityId',
          [actor.tenantId, actor.identityId]
        );
        await manager.query(
          'SELECT ownerIdentityId FROM article_workspaces WHERE tenantId = ? AND ownerIdentityId = ? FOR UPDATE',
          [actor.tenantId, actor.identityId]
        );
        return action(manager);
      })
    );
  }
  private async guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (
        error instanceof CanonicalIdentityAccessDenied ||
        error instanceof ArticleCoverConflictError ||
        error instanceof ArticleCoverInputError ||
        error instanceof ArticleCoverNotFoundError ||
        error instanceof ArticleCoverRateLimitError ||
        error instanceof ArticleCoverUnavailableError
      )
        throw error;
      throw new ArticleCoverUnavailableError(
        'Could not confirm the image operation. Retry with the same Idempotency-Key.'
      );
    }
  }
}
