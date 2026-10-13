import type { DataSource, EntityManager } from 'typeorm';
import type {
  EditorialProjection,
  EditorialProjectionKind,
} from '@apps/shared';
import type { AccountErasureRequest } from '@sdk/features/identity/core';
import {
  inspectEditorialProjection,
  isEditorialScope,
} from '../application/editorial-materialization';
import { editorialSqlInteger } from '../infrastructure/mysql-editorial-snapshot';
import { lockEditorialErasure } from './mysql-editorial-erasure-authority';
import {
  assertEditorialErasureTarget,
  type EditorialProjectionErasureRepository,
  type EditorialProjectionErasureTarget,
} from './erase-editorial-projections';

type Row = Record<string, unknown>;

export class MysqlEditorialProjectionErasure
  implements EditorialProjectionErasureRepository
{
  constructor(private readonly source: DataSource) {}

  next(
    input: AccountErasureRequest
  ): Promise<EditorialProjectionErasureTarget | null> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const { request } = await lockEditorialErasure(manager, input);
      if (
        (
          await manager.query(
            'SELECT resourceId FROM editorial_resource_states WHERE ownerIdentityId=? LIMIT 1',
            [request.identityId]
          )
        ).length
      )
        throw new Error(
          'Canonical Editorial anonymity must finish before projection erasure'
        );
      const [row]: Row[] = await manager.query(
        'SELECT * FROM editorial_erasure_resources WHERE identityId=? ORDER BY resourceKind,resourceId LIMIT 1',
        [request.identityId]
      );
      if (!row) return null;
      const [state]: Row[] = await manager.query(
        'SELECT * FROM editorial_resource_states WHERE resourceKind=? AND resourceId=? FOR UPDATE',
        [row.resourceKind, row.resourceId]
      );
      const target = this.target(row, request, state?.tenantId);
      this.authority(state, target, request);
      return target;
    });
  }

  complete(
    input: AccountErasureRequest,
    target: EditorialProjectionErasureTarget,
    value: EditorialProjection
  ): Promise<boolean> {
    assertEditorialErasureTarget(target);
    const projection = inspectEditorialProjection(value);
    if (
      projection.kind !== target.kind ||
      projection.resourceId !== target.resourceId ||
      projection.tenantId !== target.tenantId ||
      projection.revision < target.minimumRevision
    )
      throw new Error('Editorial erasure confirmation differs from its target');
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const { request } = await lockEditorialErasure(manager, input);
      const state = await this.current(manager, target);
      this.authority(state, target, request);
      if (editorialSqlInteger(state.revision, 1) !== projection.revision)
        return false;
      if (
        state.tenantId !== projection.tenantId ||
        (state.deletedAt === null
          ? null
          : editorialSqlInteger(state.deletedAt)) !== projection.deletedAt
      )
        throw new Error(
          'Editorial erasure confirmation differs from canonical lifecycle'
        );
      const [row]: Row[] = await manager.query(
        'SELECT * FROM editorial_erasure_resources WHERE identityId=? AND resourceKind=? AND resourceId=? FOR UPDATE',
        [request.identityId, target.kind, target.resourceId]
      );
      if (!row) return true;
      const stored = this.target(row, request, state.tenantId);
      if (
        stored.minimumRevision !== target.minimumRevision ||
        stored.tenantId !== target.tenantId
      )
        throw new Error('Editorial projection erasure target changed');
      const result = await manager.query(
        'DELETE FROM editorial_erasure_resources WHERE identityId=? AND resourceKind=? AND resourceId=? AND erasureRevision=? AND projectionRevision=?',
        [
          request.identityId,
          target.kind,
          target.resourceId,
          request.revision,
          target.minimumRevision,
        ]
      );
      if (result.affectedRows !== 1)
        throw new Error('Editorial projection erasure target was not removed');
      return true;
    });
  }

  private async current(
    manager: EntityManager,
    target: EditorialProjectionErasureTarget
  ): Promise<Row | undefined> {
    const [state]: Row[] = await manager.query(
      'SELECT * FROM editorial_resource_states WHERE resourceKind=? AND resourceId=? FOR UPDATE',
      [target.kind, target.resourceId]
    );
    return state;
  }

  private target(
    row: Row,
    request: AccountErasureRequest,
    tenant: unknown
  ): EditorialProjectionErasureTarget {
    if (
      row.identityId !== request.identityId ||
      editorialSqlInteger(row.erasureRevision, 1) !== request.revision ||
      !isEditorialScope(tenant)
    )
      throw new Error('Editorial projection erasure request changed');
    const target = {
      kind: row.resourceKind as EditorialProjectionKind,
      resourceId: String(row.resourceId),
      tenantId: tenant,
      minimumRevision: editorialSqlInteger(row.projectionRevision, 2),
    };
    assertEditorialErasureTarget(target);
    return target;
  }

  private authority(
    state: Row | undefined,
    target: EditorialProjectionErasureTarget,
    request: AccountErasureRequest
  ): asserts state is Row {
    if (
      !state ||
      state.tenantId !== target.tenantId ||
      (state.ownerIdentityId !== null &&
        !isEditorialScope(state.ownerIdentityId)) ||
      state.ownerIdentityId === request.identityId ||
      editorialSqlInteger(state.revision, 1) < target.minimumRevision ||
      (Number(state.revision) === target.minimumRevision &&
        state.ownerIdentityId !== null)
    )
      throw new Error(
        'Editorial projection erasure lacks anonymous or transferred authority'
      );
  }
}
