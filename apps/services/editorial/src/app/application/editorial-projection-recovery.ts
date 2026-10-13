import type { EditorialProjectionKind } from '@apps/shared';
import {
  assertEditorialSnapshot,
  EditorialProjectionStore,
  EditorialSnapshotReader,
  inspectEditorialProjection,
  projectEditorialSnapshot,
} from './editorial-materialization';

export interface EditorialRecoveryCursor {
  kind: EditorialProjectionKind;
  resourceId: string;
}
export interface EditorialRecoveryResource extends EditorialRecoveryCursor {
  tenantId: string;
  revision: number;
  deletedAt: number | null;
}
export interface EditorialRecoverySource {
  ceiling(): Promise<EditorialRecoveryCursor | null>;
  page(
    after: EditorialRecoveryCursor | null,
    through: EditorialRecoveryCursor,
    limit: number
  ): Promise<EditorialRecoveryResource[]>;
  current(
    resource: EditorialRecoveryCursor
  ): Promise<EditorialRecoveryResource | null>;
  /** Lock and recheck the inspected state, then durably enqueue its current revision. */
  enqueue(resource: EditorialRecoveryResource): Promise<boolean>;
}

export type EditorialRecoveryCondition =
  | 'current'
  | 'missing'
  | 'stale'
  | 'conflict'
  | 'changed'
  | 'failed'
  | 'rebuild';
export interface EditorialRecoveryResult extends EditorialRecoveryCursor {
  condition: EditorialRecoveryCondition;
  queued: boolean;
}
export interface EditorialRecoveryReport {
  inspected: number;
  current: number;
  needsRebuild: number;
  queued: number;
  changed: number;
  conflicts: number;
  failed: number;
}

function compare(
  a: EditorialRecoveryCursor,
  b: EditorialRecoveryCursor
): number {
  const left = `${a.kind}:${a.resourceId}`;
  const right = `${b.kind}:${b.resourceId}`;
  return left < right ? -1 : left > right ? 1 : 0;
}

function unchanged(
  a: EditorialRecoveryResource,
  b: EditorialRecoveryResource | null
): boolean {
  return (
    b !== null &&
    compare(a, b) === 0 &&
    a.tenantId === b.tenantId &&
    a.revision === b.revision &&
    a.deletedAt === b.deletedAt
  );
}

async function scan(
  source: EditorialRecoverySource,
  inspect: (
    resource: EditorialRecoveryResource
  ) => Promise<EditorialRecoveryResult>,
  onResult?: (result: EditorialRecoveryResult) => void
): Promise<EditorialRecoveryReport> {
  const report = {
    inspected: 0,
    current: 0,
    needsRebuild: 0,
    queued: 0,
    changed: 0,
    conflicts: 0,
    failed: 0,
  };
  const ceiling = await source.ceiling();
  if (!ceiling) return report;
  let after: EditorialRecoveryCursor | null = null;
  while (true) {
    const page = await source.page(after, ceiling, 100);
    assertEditorialSnapshot(page.length <= 100, 'Oversized recovery page');
    if (!page.length) break;
    for (const resource of page) {
      assertEditorialSnapshot(
        (after === null || compare(resource, after) > 0) &&
          compare(resource, ceiling) <= 0,
        'Invalid recovery cursor progression'
      );
      after = { kind: resource.kind, resourceId: resource.resourceId };
      report.inspected++;
      let result: EditorialRecoveryResult;
      try {
        result = await inspect(resource);
      } catch {
        result = { ...after, condition: 'failed', queued: false };
      }
      if (result.condition === 'current') report.current++;
      if (['missing', 'stale', 'rebuild'].includes(result.condition))
        report.needsRebuild++;
      if (result.condition === 'changed') report.changed++;
      if (result.condition === 'conflict') report.conflicts++;
      if (result.condition === 'failed') report.failed++;
      if (result.queued) report.queued++;
      onResult?.(result);
    }
  }
  return report;
}

export function rebuildEditorialProjections(
  source: EditorialRecoverySource,
  onResult?: (result: EditorialRecoveryResult) => void
): Promise<EditorialRecoveryReport> {
  return scan(
    source,
    async (resource) => {
      const queued = await source.enqueue(resource);
      return {
        kind: resource.kind,
        resourceId: resource.resourceId,
        condition: queued ? 'rebuild' : 'changed',
        queued,
      };
    },
    onResult
  );
}

export function reconcileEditorialProjections(
  source: EditorialRecoverySource,
  reader: EditorialSnapshotReader,
  projections: EditorialProjectionStore,
  options: {
    apply?: boolean;
    onResult?: (result: EditorialRecoveryResult) => void;
  } = {}
): Promise<EditorialRecoveryReport> {
  return scan(
    source,
    async (resource) => {
      const expected = projectEditorialSnapshot(
        await reader.read(resource.kind, resource.resourceId)
      );
      assertEditorialSnapshot(
        expected.kind === resource.kind &&
          expected.resourceId === resource.resourceId,
        'Recovery snapshot identity mismatch'
      );
      const found = await projections.find(resource.kind, resource.resourceId);
      let condition: EditorialRecoveryCondition = 'missing';
      if (found !== null) {
        try {
          const projection = inspectEditorialProjection(found);
          condition =
            projection._id !== expected._id ||
            projection.tenantId !== expected.tenantId ||
            projection.revision > expected.revision
              ? 'conflict'
              : projection.revision < expected.revision
              ? 'stale'
              : projection.fingerprint === expected.fingerprint
              ? 'current'
              : 'conflict';
        } catch {
          condition = 'conflict';
        }
      }
      if (!unchanged(expected, await source.current(resource)))
        condition = 'changed';
      let queued = false;
      if (options.apply && (condition === 'missing' || condition === 'stale')) {
        queued = await source.enqueue(expected);
        if (!queued) condition = 'changed';
      }
      return {
        kind: resource.kind,
        resourceId: resource.resourceId,
        condition,
        queued,
      };
    },
    options.onResult
  );
}
