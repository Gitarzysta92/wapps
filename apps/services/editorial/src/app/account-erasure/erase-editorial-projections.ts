import type {
  EditorialProjection,
  EditorialProjectionKind,
} from '@apps/shared';
import {
  accountErasureRequest,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import {
  assertEditorialSnapshot,
  inspectEditorialProjection,
  isEditorialResourceId,
  isEditorialScope,
  projectEditorialSnapshot,
  type EditorialProjectionStore,
  type EditorialSnapshotReader,
} from '../application/editorial-materialization';

export interface EditorialProjectionErasureTarget {
  kind: EditorialProjectionKind;
  resourceId: string;
  tenantId: string;
  minimumRevision: number;
}

export interface EditorialProjectionErasureRepository {
  next(
    request: AccountErasureRequest
  ): Promise<EditorialProjectionErasureTarget | null>;
  /** Remove only the exact target after durable projection confirmation and an unchanged SQL revision. */
  complete(
    request: AccountErasureRequest,
    target: EditorialProjectionErasureTarget,
    projection: EditorialProjection
  ): Promise<boolean>;
}

export function assertEditorialErasureTarget(
  target: EditorialProjectionErasureTarget
): void {
  assertEditorialSnapshot(
    ['app', 'category', 'tag', 'suite', 'article', 'release'].includes(
      target.kind
    ) &&
      isEditorialResourceId(target.resourceId) &&
      isEditorialScope(target.tenantId) &&
      Number.isSafeInteger(target.minimumRevision) &&
      target.minimumRevision >= 2,
    'Invalid Editorial projection erasure target'
  );
}

/** One canonical target per call; publication uses the same monotonic complete-document protocol as the worker. */
export class EraseEditorialProjections {
  constructor(
    private readonly repository: EditorialProjectionErasureRepository,
    private readonly reader: EditorialSnapshotReader,
    private readonly projections: EditorialProjectionStore
  ) {}

  async advance(input: AccountErasureRequest): Promise<'pending' | 'drained'> {
    const request = accountErasureRequest(input);
    const target = await this.repository.next(request);
    if (!target) return 'drained';
    assertEditorialErasureTarget(target);
    const expected = projectEditorialSnapshot(
      await this.reader.read(target.kind, target.resourceId)
    );
    assertEditorialSnapshot(
      expected.kind === target.kind &&
        expected.resourceId === target.resourceId &&
        expected.tenantId === target.tenantId &&
        expected.revision >= target.minimumRevision,
      'Editorial erasure snapshot differs from its canonical target'
    );
    await this.projections.publish(expected);
    const found = await this.projections.find(target.kind, target.resourceId);
    if (found === null) return 'pending';
    const stored = inspectEditorialProjection(found);
    assertEditorialSnapshot(
      stored._id === expected._id && stored.tenantId === expected.tenantId,
      'Editorial erasure projection scope differs'
    );
    // A concurrent publisher may already have advanced this resource. Reread authority on the next call.
    if (stored.revision !== expected.revision) return 'pending';
    assertEditorialSnapshot(
      stored.fingerprint === expected.fingerprint,
      'Editorial erasure projection conflicts with canonical content'
    );
    await this.repository.complete(request, target, expected);
    return 'pending';
  }
}
