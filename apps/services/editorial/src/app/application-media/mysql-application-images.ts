import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import { lockIdentityWrites } from '@sdk/extras/identity-mysql';
import { randomBytes } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  APPLICATION_IMAGE_UPLOAD_LIFETIME,
  APPLICATION_IMAGE_PENDING_LIMIT,
  APPLICATION_IMAGE_DAILY_LIMIT,
  APPLICATION_IMAGE_RETAINED_LIMIT,
  APPLICATION_IMAGE_ATTEMPT_LIMIT,
  ApplicationImageConflictError,
  ApplicationImageInputError,
  ApplicationImageNotFoundError,
  ApplicationImageRateLimitError,
  ApplicationImageUnavailableError,
  assertApplicationImageUploadWritable,
  assertApplicationImageCancellation,
  parseApplicationImageAsset,
  parseApplicationImageUpload,
  parseApplicationImageUploadReceipt,
  type ApplicationImageAsset,
  type ApplicationImageUploadReceipt,
} from '@domains/catalog/media';
import type { EditorialActor } from '../application/editorial.ports';
import type {
  ApplicationImageCommand,
  ApplicationImageContentCommand,
  ApplicationImageCreateCommand,
  ApplicationImageCancelCommand,
  ApplicationImageReservation,
  ApplicationImageStore,
} from './application-image.ports';
import {
  applicationImageReferenced,
  retireApplicationImage,
} from './application-image-retirement';
import { recordEditorialMediaAsset } from './editorial-media-assets';

export const APPLICATION_IMAGE_LEASE_MS = 30_000;
export const APPLICATION_IMAGE_COMMAND_ATTEMPTS = 3;
export interface ApplicationImageRow extends Record<string, unknown> {
  id: string;
  tenantId: string;
  ownerIdentityId: string;
  draftId: string;
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
export function applicationImageFromRow(row: ApplicationImageRow) {
  try {
    return parseApplicationImageUpload({
      id: row.id,
      draftId: row.draftId,
      purpose: row.purpose,
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
    throw new ApplicationImageUnavailableError(
      'Stored application image is invalid'
    );
  }
}

/** Private uploads share the draft owner's lock; object I/O never runs inside these transactions. */
export class MysqlApplicationImages implements ApplicationImageStore {
  constructor(private readonly source: DataSource) {}
  async list(actor: EditorialActor, draftId: string, at: number) {
    return this.guard(() =>
      this.source.transaction('REPEATABLE READ', async (manager) => {
        const drafts = await manager.query(
          'SELECT id FROM application_drafts WHERE id = ? AND tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL',
          [draftId, actor.tenantId, actor.identityId]
        );
        if (drafts.length !== 1)
          throw new ApplicationImageNotFoundError(
            'Application draft not found'
          );
        const rows = await manager.query<ApplicationImageRow[]>(
          "SELECT * FROM application_image_uploads WHERE draftId = ? AND tenantId = ? AND ownerIdentityId = ? AND (status = 'ready' OR (status = 'pending' AND expiresAt > ?)) ORDER BY createdAt DESC, id LIMIT ?",
          [
            draftId,
            actor.tenantId,
            actor.identityId,
            at,
            APPLICATION_IMAGE_RETAINED_LIMIT + 1,
          ]
        );
        if (rows.length > APPLICATION_IMAGE_RETAINED_LIMIT)
          throw new ApplicationImageUnavailableError(
            'Image upload capacity is invalid'
          );
        return rows.map(applicationImageFromRow);
      })
    );
  }
  async cancel(command: ApplicationImageCancelCommand) {
    return this.write(command.actor, async (manager) => {
      const row = await this.row(manager, command.actor, command.id, true);
      const prior = await this.command(manager, command);
      if (prior) return this.receipt(prior);
      this.assertLiveDraft(row);
      const upload = applicationImageFromRow(row);
      assertApplicationImageCancellation(
        upload,
        command.expectedRevision,
        await applicationImageReferenced(manager, upload.id)
      );
      const receipt = await retireApplicationImage(
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
  async create(command: ApplicationImageCreateCommand) {
    return this.write(command.actor, async (manager) => {
      const prior = await this.command(manager, command);
      if (prior) {
        await this.row(manager, command.actor, prior.imageId);
        return this.receipt(prior);
      }
      const { actor, input, id, at } = command;
      const [draft] = await manager.query<{ id: string }[]>(
        'SELECT id FROM application_drafts WHERE id = ? AND tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL',
        [input.draftId, actor.tenantId, actor.identityId]
      );
      if (!draft)
        throw new ApplicationImageNotFoundError('Application draft not found');
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
        FROM application_image_uploads WHERE tenantId = ? AND ownerIdentityId = ?`,
        [
          at,
          at - APPLICATION_IMAGE_UPLOAD_LIFETIME,
          at,
          actor.tenantId,
          actor.identityId,
        ]
      );
      if (
        Number(count.pending) >= APPLICATION_IMAGE_PENDING_LIMIT ||
        Number(count.recent) >= APPLICATION_IMAGE_DAILY_LIMIT ||
        Number(count.retained) >= APPLICATION_IMAGE_RETAINED_LIMIT
      )
        throw new ApplicationImageRateLimitError(
          'Image upload capacity reached. Remove unused images or retry after older reservations expire.'
        );
      const upload = parseApplicationImageUpload({
        ...input,
        id,
        revision: 1,
        status: 'pending',
        createdAt: at,
        expiresAt: at + APPLICATION_IMAGE_UPLOAD_LIFETIME,
        asset: null,
      });
      await manager.query(
        `INSERT INTO application_image_uploads
        (id, tenantId, ownerIdentityId, draftId, purpose, sourceType, sourceBytes, sourceSha256, revision, status, createdAt, expiresAt, asset, attempts, leaseToken, leaseUntil, commandKey)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?, NULL, 0, NULL, NULL, NULL)`,
        [
          id,
          actor.tenantId,
          actor.identityId,
          input.draftId,
          input.purpose,
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
      return applicationImageFromRow(row);
    });
  }
  async reserve(
    command: ApplicationImageContentCommand
  ): Promise<ApplicationImageReservation> {
    return this.write(command.actor, async (manager) => {
      const row = await this.row(manager, command.actor, command.id, true);
      const prior = await this.command(manager, command);
      if (prior && prior.receipt !== null)
        return { receipt: this.receipt(prior) };
      this.assertLiveDraft(row);
      const upload = applicationImageFromRow(row);
      assertApplicationImageUploadWritable(
        upload,
        command.expectedRevision,
        command.at
      );
      this.assertSource(upload.source, command);
      if (row.leaseUntil !== null && Number(row.leaseUntil) > command.at)
        throw new ApplicationImageUnavailableError(
          'This upload is processing. Retry the same request shortly.'
        );
      if (
        row.attempts >= APPLICATION_IMAGE_ATTEMPT_LIMIT ||
        (prior?.executions ?? 0) >= APPLICATION_IMAGE_COMMAND_ATTEMPTS
      )
        throw new ApplicationImageRateLimitError(
          'Image processing retry limit reached. Create a new upload reservation.'
        );
      if (!prior) await this.insertCommand(manager, command, null);
      const lease = randomBytes(32).toString('hex');
      await manager.query(
        'UPDATE application_image_uploads SET attempts = attempts + 1, leaseToken = ?, leaseUntil = ?, commandKey = ? WHERE id = ?',
        [
          lease,
          Math.min(command.at + APPLICATION_IMAGE_LEASE_MS, upload.expiresAt),
          command.key,
          command.id,
        ]
      );
      await manager.query(
        'UPDATE application_image_commands SET executions = executions + 1 WHERE tenantId = ? AND ownerIdentityId = ? AND commandKey = ?',
        [command.actor.tenantId, command.actor.identityId, command.key]
      );
      return { upload, lease };
    });
  }
  async complete(
    command: ApplicationImageContentCommand,
    lease: string,
    value: ApplicationImageAsset,
    at: number
  ) {
    return this.write(command.actor, async (manager) => {
      const row = await this.row(manager, command.actor, command.id, true);
      const prior = await this.command(manager, command);
      if (prior && prior.receipt !== null) return this.receipt(prior);
      this.assertLiveDraft(row);
      const upload = applicationImageFromRow(row);
      assertApplicationImageUploadWritable(
        upload,
        command.expectedRevision,
        at
      );
      this.assertSource(upload.source, command);
      if (
        !prior ||
        row.leaseToken !== lease ||
        row.commandKey !== command.key ||
        row.leaseUntil === null ||
        Number(row.leaseUntil) <= at ||
        at < command.at
      )
        throw new ApplicationImageConflictError(
          'The image processing lease expired. Retry the same request.'
        );
      const asset = parseApplicationImageAsset(value);
      if (asset.id !== upload.id || asset.purpose !== upload.purpose)
        throw new ApplicationImageInputError(
          'The normalized image does not match its reservation'
        );
      const receipt = parseApplicationImageUploadReceipt({
        id: upload.id,
        revision: upload.revision + 1,
        status: 'ready',
      });
      await recordEditorialMediaAsset(manager, {
        kind: 'application',
        imageId: upload.id,
        tenantId: command.actor.tenantId,
        articleId: null,
        asset,
        createdAt: upload.createdAt,
        retiredAt: null,
      });
      await manager.query(
        "UPDATE application_image_uploads SET status = 'ready', revision = ?, asset = ?, leaseToken = NULL, leaseUntil = NULL, commandKey = NULL WHERE id = ?",
        [receipt.revision, JSON.stringify(asset), upload.id]
      );
      await manager.query(
        'UPDATE application_image_commands SET receipt = ?, completedAt = ? WHERE tenantId = ? AND ownerIdentityId = ? AND commandKey = ?',
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
  async fail(
    command: ApplicationImageContentCommand,
    lease: string,
    at: number
  ) {
    return this.write(command.actor, async (manager) => {
      // A late failure cannot release a replacement worker's lease or undo an uncertain successful commit.
      await manager.query(
        "UPDATE application_image_uploads SET leaseToken = NULL, leaseUntil = NULL, commandKey = NULL WHERE id = ? AND tenantId = ? AND ownerIdentityId = ? AND status = 'pending' AND leaseToken = ? AND commandKey = ? AND leaseUntil > ?",
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
    command: ApplicationImageContentCommand
  ) {
    if (
      source.bytes !== command.sourceBytes ||
      source.sha256 !== command.sourceSha256
    )
      throw new ApplicationImageInputError(
        'Select the exact file reserved for this upload'
      );
  }
  private assertLiveDraft(row: ApplicationImageRow) {
    if (row.draftDeletedAt !== null)
      throw new ApplicationImageNotFoundError('Application draft not found');
  }
  private async row(
    manager: EntityManager,
    actor: EditorialActor,
    id: string,
    lock = false
  ) {
    const [row] = await manager.query<ApplicationImageRow[]>(
      `SELECT i.*, d.deletedAt AS draftDeletedAt FROM application_image_uploads i
      INNER JOIN application_drafts d ON d.id = i.draftId AND d.tenantId = i.tenantId AND d.ownerIdentityId = i.ownerIdentityId
      WHERE i.id = ? AND i.tenantId = ? AND i.ownerIdentityId = ?${
        lock ? ' FOR UPDATE' : ''
      }`,
      [id, actor.tenantId, actor.identityId]
    );
    if (!row)
      throw new ApplicationImageNotFoundError('Application image not found');
    return row;
  }
  private async command(
    manager: EntityManager,
    command: ApplicationImageCommand
  ) {
    const [row] = await manager.query<CommandRow[]>(
      'SELECT imageId, fingerprint, receipt, executions FROM application_image_commands WHERE tenantId = ? AND ownerIdentityId = ? AND commandKey = ?',
      [command.actor.tenantId, command.actor.identityId, command.key]
    );
    if (row && row.fingerprint !== command.fingerprint)
      throw new ApplicationImageConflictError(
        'Idempotency-Key was used for another command'
      );
    return row;
  }
  private receipt(row: CommandRow) {
    try {
      const receipt = parseApplicationImageUploadReceipt(
        typeof row.receipt === 'string' ? JSON.parse(row.receipt) : row.receipt
      );
      if (receipt.id !== row.imageId) throw new Error('Receipt image mismatch');
      return receipt;
    } catch {
      throw new ApplicationImageUnavailableError(
        'Stored image receipt is invalid'
      );
    }
  }
  private async insertCommand(
    manager: EntityManager,
    command: ApplicationImageCommand,
    receipt: ApplicationImageUploadReceipt | null
  ) {
    await manager.query(
      'INSERT INTO application_image_commands (tenantId, ownerIdentityId, commandKey, imageId, fingerprint, receipt, executions, createdAt, completedAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
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
          'INSERT INTO application_workspaces (tenantId, ownerIdentityId) VALUES (?, ?) ON DUPLICATE KEY UPDATE ownerIdentityId = ownerIdentityId',
          [actor.tenantId, actor.identityId]
        );
        await manager.query(
          'SELECT ownerIdentityId FROM application_workspaces WHERE tenantId = ? AND ownerIdentityId = ? FOR UPDATE',
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
        error instanceof ApplicationImageConflictError ||
        error instanceof ApplicationImageInputError ||
        error instanceof ApplicationImageNotFoundError ||
        error instanceof ApplicationImageRateLimitError ||
        error instanceof ApplicationImageUnavailableError
      )
        throw error;
      throw new ApplicationImageUnavailableError(
        'Could not confirm the image operation. Retry with the same Idempotency-Key.'
      );
    }
  }
}
