import type { DataSource, EntityManager } from 'typeorm';
import type { EditorialSnapshot } from '@apps/shared';
import {
  assertEditorialBackfillReceipt,
  EditorialBackfillError,
  EditorialBackfillPlan,
  EditorialBackfillReceipt,
  EditorialBackfillSource,
  EditorialOwnershipManifest,
  parseEditorialOwnershipManifest,
  planEditorialBackfill,
} from '../application/editorial-backfill';
import {
  MysqlEditorialSnapshotReader,
  editorialSqlInteger,
} from './mysql-editorial-snapshot';

const tables = {
  app: 'app_records',
  category: 'categories',
  tag: 'tags',
} as const;

export class MysqlEditorialBackfill implements EditorialBackfillSource {
  private readonly snapshots: MysqlEditorialSnapshotReader;

  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string,
    private readonly now: () => number = Date.now
  ) {
    this.snapshots = new MysqlEditorialSnapshotReader(source, publicTenant);
  }

  read(input: EditorialOwnershipManifest): Promise<EditorialSnapshot> {
    const manifest = this.manifest(input);
    return this.source.transaction('REPEATABLE READ', (manager) =>
      this.legacy(manager, manifest)
    );
  }

  receipt(
    input: EditorialOwnershipManifest
  ): Promise<EditorialBackfillReceipt | null> {
    const manifest = this.manifest(input);
    return this.source.transaction('REPEATABLE READ', (manager) =>
      this.committed(manager, manifest)
    );
  }

  commit(plan: EditorialBackfillPlan): Promise<EditorialBackfillReceipt> {
    const manifest = this.manifest(plan.manifest);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      // Importers and ordinary writers serialize on the same authoritative base row.
      const rows = await manager.query<{ id: string }[]>(
        `SELECT id FROM ${tables[manifest.kind]} WHERE id = ? FOR UPDATE`,
        [manifest.resourceId]
      );
      if (rows.length !== 1)
        throw new EditorialBackfillError('Legacy resource is missing');
      const existing = await this.committed(manager, manifest);
      if (existing) {
        assertEditorialBackfillReceipt(manifest, plan.fingerprint, existing);
        return existing;
      }
      const current = planEditorialBackfill(
        manifest,
        await this.legacy(manager, manifest)
      );
      if (
        current.fingerprint !== plan.fingerprint ||
        current.manifestFingerprint !== plan.manifestFingerprint ||
        current.sourceFingerprint !== plan.sourceFingerprint
      )
        throw new EditorialBackfillError(
          'Legacy source changed before commit; inspect a new plan'
        );
      const at = editorialSqlInteger(this.now());
      await manager.query(
        `INSERT INTO editorial_resource_states (resourceKind, resourceId, tenantId, ownerIdentityId, revision, deletedAt) VALUES (?, ?, ?, ?, 1, NULL)`,
        [
          manifest.kind,
          manifest.resourceId,
          manifest.tenantId,
          manifest.ownerIdentityId,
        ]
      );
      await manager.query(
        `INSERT INTO editorial_outbox (resourceKind, resourceId, tenantId, revision, operation, actorIdentityId, createdAt, availableAt) VALUES (?, ?, ?, 1, 'backfill', 'system:editorial-backfill', ?, ?)`,
        [manifest.kind, manifest.resourceId, manifest.tenantId, at, at]
      );
      await manager.query(
        `INSERT INTO editorial_backfills (resourceKind, resourceId, manifestFingerprint, sourceFingerprint, fingerprint, revision, committedAt) VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [
          manifest.kind,
          manifest.resourceId,
          current.manifestFingerprint,
          current.sourceFingerprint,
          current.fingerprint,
          at,
        ]
      );
      return {
        kind: manifest.kind,
        resourceId: manifest.resourceId,
        manifestFingerprint: current.manifestFingerprint,
        sourceFingerprint: current.sourceFingerprint,
        fingerprint: current.fingerprint,
        revision: 1,
      };
    });
  }

  private manifest(
    input: EditorialOwnershipManifest
  ): EditorialOwnershipManifest {
    const manifest = parseEditorialOwnershipManifest(input);
    // Legacy rows are public today. Ownership adoption must not silently relocate their tenant.
    if (manifest.tenantId !== this.publicTenant)
      throw new EditorialBackfillError(
        'Legacy ownership backfill must preserve EDITORIAL_PUBLIC_TENANT; tenant relocation requires a separate reviewed migration'
      );
    return manifest;
  }

  private async legacy(
    manager: EntityManager,
    manifest: EditorialOwnershipManifest
  ): Promise<EditorialSnapshot> {
    const states = await manager.query<unknown[]>(
      'SELECT resourceId FROM editorial_resource_states WHERE resourceKind = ? AND resourceId = ?',
      [manifest.kind, manifest.resourceId]
    );
    if (states.length)
      throw new EditorialBackfillError(
        'Resource is already versioned; backfill cannot replace ownership'
      );
    const receipts = await manager.query<unknown[]>(
      'SELECT resourceId FROM editorial_backfills WHERE resourceKind = ? AND resourceId = ?',
      [manifest.kind, manifest.resourceId]
    );
    const intents = await manager.query<unknown[]>(
      'SELECT id FROM editorial_outbox WHERE resourceKind = ? AND resourceId = ? LIMIT 1',
      [manifest.kind, manifest.resourceId]
    );
    const commands = await manager.query<unknown[]>(
      'SELECT resourceId FROM editorial_commands WHERE resourceKind = ? AND resourceId = ? LIMIT 1',
      [manifest.kind, manifest.resourceId]
    );
    if (receipts.length || intents.length || commands.length)
      throw new EditorialBackfillError(
        'Partial authoritative history exists; inspect before backfill'
      );
    return this.snapshots.readValues(
      manager,
      manifest.kind,
      manifest.resourceId,
      {
        tenantId: manifest.tenantId,
        ownerIdentityId: manifest.ownerIdentityId,
        revision: 1,
        deletedAt: null,
      }
    );
  }

  private async committed(
    manager: EntityManager,
    manifest: EditorialOwnershipManifest
  ): Promise<EditorialBackfillReceipt | null> {
    const [row] = await manager.query<Record<string, unknown>[]>(
      'SELECT manifestFingerprint, sourceFingerprint, fingerprint, revision FROM editorial_backfills WHERE resourceKind = ? AND resourceId = ?',
      [manifest.kind, manifest.resourceId]
    );
    if (!row) return null;
    const [state] = await manager.query<Record<string, unknown>[]>(
      'SELECT tenantId, ownerIdentityId, revision FROM editorial_resource_states WHERE resourceKind = ? AND resourceId = ?',
      [manifest.kind, manifest.resourceId]
    );
    if (
      !state ||
      state.tenantId !== manifest.tenantId ||
      state.ownerIdentityId !== manifest.ownerIdentityId ||
      editorialSqlInteger(state.revision, 1) < 1
    )
      throw new EditorialBackfillError(
        'Committed ownership differs from the verified manifest'
      );
    const { manifestFingerprint, sourceFingerprint, fingerprint } = row;
    if (
      editorialSqlInteger(row.revision, 1) !== 1 ||
      typeof manifestFingerprint !== 'string' ||
      typeof sourceFingerprint !== 'string' ||
      typeof fingerprint !== 'string' ||
      ![manifestFingerprint, sourceFingerprint, fingerprint].every((value) =>
        /^[a-f0-9]{64}$/.test(value)
      )
    )
      throw new EditorialBackfillError(
        'Invalid authoritative backfill receipt'
      );
    return {
      kind: manifest.kind,
      resourceId: manifest.resourceId,
      manifestFingerprint,
      sourceFingerprint,
      fingerprint,
      revision: 1,
    };
  }
}
