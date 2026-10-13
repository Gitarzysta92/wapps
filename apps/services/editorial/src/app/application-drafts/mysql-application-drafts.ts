import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import { lockIdentityWrites } from '@sdk/extras/identity-mysql';
import type { DataSource, EntityManager } from 'typeorm';
import type { ApplicationImageSet } from '@domains/catalog/media';
import {
  draftApplicationImages,
  canonicalApplicationImages,
  draftImageSelection,
  saveDraftApplicationImages,
} from '../application-media/application-image-bindings';
import {
  APPLICATION_DRAFT_LIMIT,
  parseApplicationDraft,
  parseApplicationDraftReceipt,
  parseApplicationEditingSource,
  ApplicationDraftConflictError,
  ApplicationDraftInputError,
  ApplicationDraftNotFoundError,
  ApplicationDraftUnavailableError,
  type ApplicationDraftReceipt,
  type ApplicationEditingTarget,
} from '@domains/catalog/record';
import type { EditorialActor } from '../application/editorial.ports';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  applicationPublicState,
  deleteApplicationPublication,
  hasApplicationAuthoringAuthority,
} from '../application-publication/application-public-state';
import { applicationEditingTarget } from './application-editing-target';
import type {
  ApplicationDraftCommand,
  ApplicationDraftStore,
} from './application-drafts';

interface DraftRow {
  id: string;
  name: string;
  slug: string;
  website: string;
  description: string;
  classification?: unknown;
  revision: string | number;
  createdAt: string | number;
  updatedAt: string | number;
  deletedAt: string | number | null;
}
function snapshot(
  row: DraftRow,
  editing?: ApplicationEditingTarget,
  images?: ApplicationImageSet
) {
  try {
    return parseApplicationDraft({
      id: row.id,
      name: row.name,
      slug: row.slug,
      website: row.website,
      description: row.description,
      classification: row.classification ?? undefined,
      revision: Number(row.revision),
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
      ...(editing ? { editing } : {}),
      ...(images ? { images } : {}),
    });
  } catch {
    throw new ApplicationDraftUnavailableError(
      'Stored application draft is invalid'
    );
  }
}

/** Private drafts read from SQL; saving them neither allocates public records nor requests projections. */
export class MysqlApplicationDrafts implements ApplicationDraftStore {
  constructor(private readonly source: DataSource) {}
  async list(actor: EditorialActor) {
    return this.source
      .transaction('REPEATABLE READ', async (manager) => {
        const rows = await manager.query<DraftRow[]>(
          'SELECT * FROM application_drafts WHERE tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL ORDER BY updatedAt DESC, id LIMIT ?',
          [actor.tenantId, actor.identityId, APPLICATION_DRAFT_LIMIT + 1]
        );
        if (rows.length > APPLICATION_DRAFT_LIMIT)
          throw new ApplicationDraftUnavailableError(
            'Application draft capacity is invalid'
          );
        return Promise.all(
          rows.map(async (row) =>
            snapshot(
              row,
              await applicationEditingTarget(manager, row.id),
              await draftApplicationImages(manager, row.id)
            )
          )
        );
      })
      .catch(() => {
        throw new ApplicationDraftUnavailableError(
          'Application drafts unavailable'
        );
      });
  }
  async read(actor: EditorialActor, id: string) {
    return this.source
      .transaction('REPEATABLE READ', async (manager) => {
        const row = await this.row(manager, actor, id);
        if (!row || row.deletedAt !== null)
          throw new ApplicationDraftNotFoundError(
            'Application draft not found'
          );
        return snapshot(
          row,
          await applicationEditingTarget(manager, row.id),
          await draftApplicationImages(manager, row.id)
        );
      })
      .catch((error: unknown) => {
        if (
          error instanceof ApplicationDraftNotFoundError ||
          error instanceof ApplicationDraftUnavailableError
        )
          throw error;
        throw new ApplicationDraftUnavailableError(
          'Application drafts unavailable'
        );
      });
  }
  async editingSource(actor: EditorialActor, id: string) {
    try {
      return await this.sourceSnapshot(actor, id);
    } catch (error) {
      if (
        error instanceof CanonicalIdentityAccessDenied ||
        error instanceof PermissionDeniedError ||
        error instanceof ApplicationDraftNotFoundError ||
        error instanceof ApplicationDraftUnavailableError
      )
        throw error;
      throw new ApplicationDraftUnavailableError(
        'Canonical application content is unavailable'
      );
    }
  }
  private async sourceSnapshot(actor: EditorialActor, id: string) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const state = await applicationPublicState(manager, id);
      const [grant] = await manager.query<{ claimId: string }[]>(
        'SELECT claimId FROM application_ownership_grants WHERE applicationId = ? AND tenantId = ? AND claimantIdentityId = ? AND revokedAt IS NULL',
        [id, actor.tenantId, actor.identityId]
      );
      if (!state || !grant || state.isSuspended)
        throw new ApplicationDraftNotFoundError(
          'No active ownership grant for this application'
        );
      if (
        !(await hasApplicationAuthoringAuthority(
          manager,
          id,
          state,
          { tenantId: actor.tenantId, ownerIdentityId: actor.identityId },
          grant.claimId
        ))
      )
        throw new PermissionDeniedError('editorial.application.publication');
      const [content] = await manager.query<
        {
          name: string;
          slug: string;
          website: string | null;
          description: string | null;
          classification: unknown;
        }[]
      >(
        'SELECT name, slug, website, description, classification FROM app_records WHERE id = ?',
        [id]
      );
      return parseApplicationEditingSource({
        applicationId: id,
        claimId: grant.claimId,
        sourcePublicationRevision: Number(state.revision),
        images: await canonicalApplicationImages(manager, id),
        fields: {
          name: content.name,
          slug: content.slug,
          website: content.website ?? '',
          description: content.description ?? '',
          classification: content.classification ?? undefined,
        },
      });
    });
  }
  async commit(
    command: ApplicationDraftCommand
  ): Promise<ApplicationDraftReceipt> {
    try {
      return await this.source.transaction(
        'READ COMMITTED',
        async (manager) => {
          const { actor, key, type, fields, id } = command;
          await lockIdentityWrites(manager, [actor.identityId]);
          const creating = type === 'create' || type === 'open';
          // All owner writes share this lock, including first-create races and slug/capacity checks.
          await manager.query(
            'INSERT INTO application_workspaces (tenantId, ownerIdentityId) VALUES (?, ?) ON DUPLICATE KEY UPDATE ownerIdentityId = ownerIdentityId',
            [actor.tenantId, actor.identityId]
          );
          await manager.query(
            'SELECT ownerIdentityId FROM application_workspaces WHERE tenantId = ? AND ownerIdentityId = ? FOR UPDATE',
            [actor.tenantId, actor.identityId]
          );
          const [receipt] = await manager.query<
            {
              fingerprint: string;
              draftId: string;
              revision: string | number;
              deleted: number;
            }[]
          >(
            'SELECT fingerprint, draftId, revision, deleted FROM application_draft_commands WHERE tenantId = ? AND ownerIdentityId = ? AND commandKey = ?',
            [actor.tenantId, actor.identityId, key]
          );
          if (receipt) {
            if (receipt.fingerprint !== command.fingerprint)
              throw new ApplicationDraftConflictError(
                'Idempotency-Key was used for another command'
              );
            if (!(await this.row(manager, actor, receipt.draftId)))
              throw new ApplicationDraftUnavailableError(
                'Draft receipt has no canonical owner'
              );
            return parseApplicationDraftReceipt({
              id: receipt.draftId,
              revision: Number(receipt.revision),
              deleted: receipt.deleted === 1,
            });
          }
          const previous = creating ? null : await this.row(manager, actor, id);
          if (!creating && (!previous || previous.deletedAt !== null))
            throw new ApplicationDraftNotFoundError(
              'Application draft not found'
            );
          if (
            previous &&
            Number(previous.revision) !== command.expectedRevision
          )
            throw new ApplicationDraftConflictError(
              'Application draft changed. Reload before editing.'
            );
          const current = previous ? snapshot(previous) : null;
          const editing = previous
            ? await applicationEditingTarget(manager, id)
            : undefined;
          if (type === 'open' || type === 'rebase') {
            const target = command.editing;
            if (
              !target ||
              (type === 'rebase' &&
                (!editing ||
                  editing.applicationId !== target.applicationId ||
                  editing.claimId !== target.claimId))
            )
              throw new ApplicationDraftConflictError(
                'An editing draft is permanently bound to its original application and ownership claim'
              );
            const state = await applicationPublicState(
              manager,
              target.applicationId,
              true
            );
            if (
              !(await hasApplicationAuthoringAuthority(
                manager,
                target.applicationId,
                state,
                { tenantId: actor.tenantId, ownerIdentityId: actor.identityId },
                target.claimId
              ))
            )
              throw new PermissionDeniedError(
                'editorial.application.publication'
              );
            if (
              !state ||
              state.isSuspended ||
              Number(state.revision) !== target.sourcePublicationRevision
            )
              throw new ApplicationDraftConflictError(
                'The canonical application changed. Reload its current content before merging your edits.'
              );
          }
          const revision = (current?.revision ?? 0) + 1;
          if (!Number.isSafeInteger(revision))
            throw new ApplicationDraftConflictError(
              'Application draft revision limit reached'
            );
          if (creating) {
            const [count] = await manager.query<{ total: string | number }[]>(
              'SELECT COUNT(*) AS total FROM application_drafts WHERE tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL',
              [actor.tenantId, actor.identityId]
            );
            if (Number(count.total) >= APPLICATION_DRAFT_LIMIT)
              throw new ApplicationDraftConflictError(
                'You can keep at most 100 application drafts'
              );
          }
          if (fields) {
            const duplicate = await manager.query(
              'SELECT id FROM application_drafts WHERE tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL AND slug = ? AND id <> ? LIMIT 1',
              [actor.tenantId, actor.identityId, fields.slug, id]
            );
            if (duplicate.length)
              throw new ApplicationDraftConflictError(
                'Another draft in your workspace uses this slug'
              );
          }
          const at = Math.max(command.at, current?.updatedAt ?? 0);
          if (type === 'delete')
            await deleteApplicationPublication(
              manager,
              id,
              actor,
              at,
              editing !== undefined
            );
          if (creating && fields) {
            await manager.query(
              'INSERT INTO application_drafts (id, tenantId, ownerIdentityId, name, slug, website, description, classification, revision, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
              [
                id,
                actor.tenantId,
                actor.identityId,
                fields.name,
                fields.slug,
                fields.website,
                fields.description,
                fields.classification ?? null,
                revision,
                at,
                at,
              ]
            );
          } else if (type === 'images') {
            const change = command.imageChange;
            if (!change)
              throw new ApplicationDraftConflictError(
                'Image selection is missing'
              );
            const images = await draftApplicationImages(manager, id);
            images[change.purpose] = await draftImageSelection(
              manager,
              actor,
              id,
              change.purpose,
              change.imageId
            );
            await saveDraftApplicationImages(
              manager,
              id,
              images,
              actor.tenantId
            );
            await manager.query(
              'UPDATE application_drafts SET revision = ?, updatedAt = ? WHERE id = ?',
              [revision, at, id]
            );
          } else {
            await manager.query(
              'UPDATE application_drafts SET name = ?, slug = ?, website = ?, description = ?, classification = ?, revision = ?, updatedAt = ?, deletedAt = ? WHERE id = ? AND tenantId = ? AND ownerIdentityId = ?',
              [
                fields?.name ?? '',
                fields?.slug ?? '',
                fields?.website ?? '',
                fields?.description ?? '',
                fields?.classification ?? null,
                revision,
                at,
                type === 'delete' ? at : null,
                id,
                actor.tenantId,
                actor.identityId,
              ]
            );
          }
          if (type === 'create' || type === 'delete')
            await saveDraftApplicationImages(
              manager,
              id,
              { logo: null, banner: null },
              actor.tenantId
            );
          if (command.editing && (type === 'open' || type === 'rebase')) {
            const canonical = await canonicalApplicationImages(
              manager,
              command.editing.applicationId
            );
            const images =
              type === 'open'
                ? canonical
                : await draftApplicationImages(manager, id);
            if (type === 'rebase') {
              if (command.imageChoices?.logo === 'canonical')
                images.logo = canonical.logo;
              if (command.imageChoices?.banner === 'canonical')
                images.banner = canonical.banner;
            }
            await saveDraftApplicationImages(
              manager,
              id,
              images,
              actor.tenantId
            );
          }
          if (command.editing && (type === 'open' || type === 'rebase')) {
            if (type === 'open')
              await manager.query(
                'INSERT INTO application_editing_targets (draftId, applicationId, claimId, sourcePublicationRevision) VALUES (?, ?, ?, ?)',
                [
                  id,
                  command.editing.applicationId,
                  command.editing.claimId,
                  command.editing.sourcePublicationRevision,
                ]
              );
            else {
              await manager.query(
                'UPDATE application_editing_targets SET sourcePublicationRevision = ? WHERE draftId = ?',
                [command.editing.sourcePublicationRevision, id]
              );
              // Explicit merge retires the pending review, without withdrawing the current public version.
              await manager.query(
                "UPDATE application_submissions SET status = 'cancelled', reviewedAt = ? WHERE applicationId = ? AND status = 'submitted'",
                [at, id]
              );
            }
          }
          await manager.query(
            'INSERT INTO application_draft_commands (tenantId, ownerIdentityId, commandKey, fingerprint, draftId, revision, deleted, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              actor.tenantId,
              actor.identityId,
              key,
              command.fingerprint,
              id,
              revision,
              type === 'delete',
              at,
            ]
          );
          return { id, revision, deleted: type === 'delete' };
        }
      );
    } catch (error) {
      if (
        error instanceof CanonicalIdentityAccessDenied ||
        error instanceof PermissionDeniedError ||
        error instanceof ApplicationDraftConflictError ||
        error instanceof ApplicationDraftInputError ||
        error instanceof ApplicationDraftNotFoundError ||
        error instanceof ApplicationDraftUnavailableError
      )
        throw error;
      throw new ApplicationDraftUnavailableError(
        'Could not confirm the application draft change. Retry with the same Idempotency-Key.'
      );
    }
  }
  private async row(manager: EntityManager, actor: EditorialActor, id: string) {
    const [row] = await manager.query<DraftRow[]>(
      'SELECT * FROM application_drafts WHERE id = ? AND tenantId = ? AND ownerIdentityId = ?',
      [id, actor.tenantId, actor.identityId]
    );
    return row ?? null;
  }
}
