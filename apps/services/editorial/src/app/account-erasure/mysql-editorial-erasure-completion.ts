import type { DataSource } from 'typeorm';
import type { AccountErasureRequest } from '@sdk/features/identity/core';
import type { EditorialErasureCompletion } from './clean-editorial-account';
import { lockEditorialErasureState } from './mysql-editorial-erasure-authority';
import { editorialWorkspaceFamilies } from './editorial-workspace-erasure.tables';

export const EDITORIAL_ERASURE_IDENTITY_COLUMNS: readonly (readonly [
  string,
  string
])[] = [
  ['editorial_resource_states', 'ownerIdentityId'],
  ['editorial_commands', 'actorIdentityId'],
  ['editorial_outbox', 'actorIdentityId'],
  ['editorial_erasure_resources', 'identityId'],
  ['article_publications', 'ownerIdentityId'],
  ['application_submissions', 'ownerIdentityId'],
  ['suite_submissions', 'ownerIdentityId'],
  ...editorialWorkspaceFamilies.flatMap((family): [string, string][] => [
    [family.drafts, 'ownerIdentityId'],
    [family.workspace, 'ownerIdentityId'],
    [family.submissions, 'reviewerIdentityId'],
    ...family.commands.map(([table, , actor]): [string, string] => [
      table,
      actor,
    ]),
  ]),
  ...['application_image', 'article_cover'].flatMap(
    (prefix): [string, string][] => [
      [`${prefix}_uploads`, 'ownerIdentityId'],
      [`${prefix}_commands`, 'ownerIdentityId'],
    ]
  ),
  ['application_ownership_workspaces', 'claimantIdentityId'],
  ['application_ownership_claims', 'claimantIdentityId'],
  ['application_ownership_claims', 'reviewerIdentityId'],
  ['application_ownership_grants', 'claimantIdentityId'],
  ['application_ownership_checks', 'actorIdentityId'],
  ['application_ownership_commands', 'actorIdentityId'],
  ['application_ownership_decisions', 'actorIdentityId'],
];

export class MysqlEditorialErasureCompletion
  implements EditorialErasureCompletion
{
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  state(request: AccountErasureRequest): Promise<'pending' | 'completed'> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const stored = await lockEditorialErasureState(manager, request);
      return stored.completedAt === null ? 'pending' : 'completed';
    });
  }

  complete(request: AccountErasureRequest): Promise<'pending' | 'completed'> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const stored = await lockEditorialErasureState(manager, request);
      if (stored.completedAt !== null) return 'completed';
      // Every supported writer takes this same permanent identity barrier before modifying attribution.
      for (const [table, column] of EDITORIAL_ERASURE_IDENTITY_COLUMNS) {
        const rows: unknown[] = await manager.query(
          `SELECT 1 FROM ${table} WHERE ${column}=? LIMIT 1`,
          [request.identityId]
        );
        if (rows.length) return 'pending';
      }
      const at = this.now();
      if (!Number.isSafeInteger(at) || at < 1)
        throw new Error('Invalid Editorial erasure completion time');
      const result = await manager.query(
        'UPDATE identity_erasure_requests SET completedAt=? WHERE identityId=? AND revision=? AND completedAt IS NULL',
        [Math.max(at, stored.requestedAt), request.identityId, request.revision]
      );
      if (result.affectedRows !== 1)
        throw new Error('Editorial erasure completion was not recorded');
      return 'completed';
    });
  }
}
