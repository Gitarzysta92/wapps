import type { EntityManager } from 'typeorm';
import type { EditorialSnapshot } from '@apps/shared';
import {
  suiteRevision,
  SuiteUnavailableError,
} from '@domains/publication/suite';
import { suitePublicState } from './suite-publication-state';
import { suitePublicationFields } from './suite-publication-fields';

/** Called inside the materializer's consistent SQL snapshot. Draft fields are never selected. */
export async function readSuitePublicationSnapshot(
  manager: EntityManager,
  id: string
): Promise<EditorialSnapshot> {
  const state = await suitePublicState(manager, id);
  if (!state)
    throw new SuiteUnavailableError(
      'Versioned suite publication is unavailable'
    );
  const snapshot: EditorialSnapshot = {
    kind: 'suite',
    resourceId: id,
    tenantId: state.tenantId,
    revision: Number(state.revision),
    deletedAt: state.deletedAt === null ? null : Number(state.deletedAt),
    content: null,
  };
  if (snapshot.deletedAt !== null) return snapshot;
  const [row] = await manager.query<Record<string, unknown>[]>(
    'SELECT * FROM suite_publications WHERE suiteId = ?',
    [id]
  );
  if (!row)
    throw new SuiteUnavailableError('Approved suite snapshot is inconsistent');
  const publishedAt = Number(row.publishedAt);
  if (
    row.publishedAt === null ||
    !Number.isSafeInteger(publishedAt) ||
    publishedAt < 0
  )
    throw new SuiteUnavailableError('Invalid suite publication time');
  snapshot.content = {
    ...suitePublicationFields(row),
    submittedRevision: suiteRevision(Number(row.submittedRevision)),
    publishedAt,
  };
  return snapshot;
}
