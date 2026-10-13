import type { EntityManager } from 'typeorm';
import {
  ApplicationDraftUnavailableError,
  parseApplicationEditingTarget,
  type ApplicationEditingTarget,
} from '@domains/catalog/record';

export async function applicationEditingTarget(
  manager: EntityManager,
  draftId: string
): Promise<ApplicationEditingTarget | undefined> {
  const [row] = await manager.query<
    {
      applicationId: string;
      claimId: string;
      sourcePublicationRevision: number | string;
    }[]
  >(
    'SELECT applicationId, claimId, sourcePublicationRevision FROM application_editing_targets WHERE draftId = ?',
    [draftId]
  );
  if (!row) return undefined;
  try {
    return parseApplicationEditingTarget({
      ...row,
      sourcePublicationRevision: Number(row.sourcePublicationRevision),
    });
  } catch {
    throw new ApplicationDraftUnavailableError(
      'Stored application editing target is invalid'
    );
  }
}
