import type { DataSource, EntityManager } from 'typeorm';
import type { AccountErasureRequest } from '@sdk/features/identity/core';
import { ACCOUNT_ERASURE_WRITER } from '@sdk/features/identity/libs/management';
import { anonymizeArticleFields } from '@domains/publication/article';
import type { EditorialProjectionKind } from '@apps/shared';
import {
  isEditorialResourceId,
  isEditorialScope,
} from '../application/editorial-materialization';
import {
  editorialSqlInteger,
  MysqlEditorialSnapshotReader,
} from '../infrastructure/mysql-editorial-snapshot';
import { canonicalArticle } from '../articles/mysql-article-state';
import { readReleasePublicationSnapshot } from '../releases/mysql-release-snapshot';
import { readSuitePublicationSnapshot } from '../suites/mysql-suite-snapshot';
import type { EditorialContributionErasure } from './editorial-contribution-erasure.port';
import { lockEditorialErasure } from './mysql-editorial-erasure-authority';
import {
  ownershipClaimFromRow,
  type OwnershipRow,
} from '../application-ownership/mysql-application-ownership';

const records = {
  app: ['app_records', 'id'],
  category: ['categories', 'id'],
  tag: ['tags', 'id'],
  article: ['article_publications', 'articleId'],
  release: ['release_publications', 'releaseId'],
  suite: ['suite_publications', 'suiteId'],
} as const;

/** Canonical anonymity, revision, outbox and cleanup target share one transaction. */
export class MysqlEditorialContributionErasure
  implements EditorialContributionErasure
{
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  advance(input: AccountErasureRequest): Promise<boolean> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const { request, requestedAt } = await lockEditorialErasure(
        manager,
        input
      );
      const [candidate]: Record<string, unknown>[] = await manager.query(
        'SELECT resourceKind,resourceId FROM editorial_resource_states WHERE ownerIdentityId=? ORDER BY resourceKind,resourceId LIMIT 1',
        [request.identityId]
      );
      if (!candidate) return false;
      if (
        typeof candidate.resourceKind !== 'string' ||
        !Object.prototype.hasOwnProperty.call(
          records,
          candidate.resourceKind
        ) ||
        !isEditorialResourceId(candidate.resourceId)
      )
        throw new Error('Invalid Editorial erasure resource');
      const kind = candidate.resourceKind as EditorialProjectionKind;
      const id = candidate.resourceId;
      const [table, key] = records[kind];
      // Ordinary publishers lock content before lifecycle. Recheck ownership after both locks.
      const content = await manager.query(
        `SELECT ${key} FROM ${table} WHERE ${key}=? FOR UPDATE`,
        [id]
      );
      const [state]: Record<string, unknown>[] = await manager.query(
        'SELECT tenantId,ownerIdentityId,revision,deletedAt FROM editorial_resource_states WHERE resourceKind=? AND resourceId=? FOR UPDATE',
        [kind, id]
      );
      if (!state) throw new Error('Missing Editorial erasure authority');
      if (state.ownerIdentityId !== request.identityId) return true;
      if (!isEditorialScope(state.tenantId))
        throw new Error('Invalid Editorial erasure tenant');
      const deletedAt =
        state.deletedAt === null ? null : editorialSqlInteger(state.deletedAt);
      if (
        content.length !== 1 &&
        !(kind === 'suite' && deletedAt !== null && !content.length)
      )
        throw new Error('Missing Editorial erasure content');
      const revision = editorialSqlInteger(
        editorialSqlInteger(state.revision, 1) + 1,
        2
      );
      if (kind === 'article') {
        const article = await canonicalArticle(manager, id);
        if (!article) throw new Error('Missing article erasure authority');
        await manager.query(
          'UPDATE article_publications SET ownerIdentityId=NULL,fields=? WHERE articleId=?',
          [JSON.stringify(anonymizeArticleFields(article.fields)), id]
        );
      } else if (kind === 'suite') {
        await readSuitePublicationSnapshot(manager, id);
      } else if (kind === 'release') {
        await readReleasePublicationSnapshot(manager, id);
      } else {
        await new MysqlEditorialSnapshotReader(
          this.source,
          state.tenantId
        ).readValues(manager, kind, id, state);
      }
      let at = Math.max(requestedAt, editorialSqlInteger(this.now(), 1));
      if (kind === 'app')
        at = await this.endGrant(
          manager,
          id,
          state.tenantId,
          request.identityId,
          revision,
          at
        );
      const result = await manager.query(
        'UPDATE editorial_resource_states SET ownerIdentityId=NULL,revision=? WHERE resourceKind=? AND resourceId=? AND ownerIdentityId=?',
        [revision, kind, id, request.identityId]
      );
      if (result.affectedRows !== 1)
        throw new Error('Editorial erasure ownership changed');
      await manager.query(
        `INSERT INTO editorial_outbox (resourceKind,resourceId,tenantId,revision,operation,actorIdentityId,createdAt,availableAt)
         VALUES (?,?,?,?,?,NULL,?,?)`,
        [
          kind,
          id,
          state.tenantId,
          revision,
          deletedAt === null ? 'publish' : 'withdraw',
          at,
          at,
        ]
      );
      await manager.query(
        `INSERT INTO editorial_erasure_resources (identityId,erasureRevision,resourceKind,resourceId,projectionRevision)
         VALUES (?,?,?,?,?)`,
        [request.identityId, request.revision, kind, id, revision]
      );
      return true;
    });
  }

  private async endGrant(
    manager: EntityManager,
    id: string,
    tenant: string,
    owner: string,
    publicRevision: number,
    at: number
  ) {
    const [grant]: Record<string, unknown>[] = await manager.query(
      'SELECT * FROM application_ownership_grants WHERE applicationId=? FOR UPDATE',
      [id]
    );
    if (!grant || grant.revokedAt !== null) return at;
    if (grant.tenantId !== tenant || grant.claimantIdentityId !== owner)
      throw new Error(
        'Editorial erasure grant does not match canonical ownership'
      );
    const [row]: OwnershipRow[] = await manager.query(
      'SELECT * FROM application_ownership_claims WHERE id=? FOR UPDATE',
      [grant.claimId]
    );
    if (
      !row ||
      row.tenantId !== tenant ||
      row.claimantIdentityId !== owner ||
      row.applicationId !== id
    )
      throw new Error('Missing Editorial erasure grant claim');
    const claim = ownershipClaimFromRow(row);
    if (
      claim.status !== 'approved' ||
      claim.verifiedAt === null ||
      owner === ACCOUNT_ERASURE_WRITER
    )
      throw new Error('Invalid Editorial erasure grant authority');
    at = Math.max(at, claim.updatedAt);
    const revision = editorialSqlInteger(claim.revision + 1, 2);
    const reason = 'Ownership ended by account erasure.';
    await manager.query(
      'UPDATE application_ownership_grants SET revokedAt=? WHERE applicationId=?',
      [at, id]
    );
    await manager.query(
      "UPDATE application_ownership_claims SET revision=?,status='revoked',updatedAt=?,reviewedAt=?,reviewerIdentityId=?,reviewerErasedAt=NULL,reason=? WHERE id=?",
      [revision, at, at, ACCOUNT_ERASURE_WRITER, reason, claim.id]
    );
    await manager.query(
      `INSERT INTO application_ownership_decisions (claimId,revision,actorIdentityId,action,reason,verifiedAt,applicationRevision,createdAt)
       VALUES (?,?,?,'revoke',?,?,?,?)`,
      [
        claim.id,
        revision,
        ACCOUNT_ERASURE_WRITER,
        reason,
        claim.verifiedAt,
        publicRevision,
        at,
      ]
    );
    return at;
  }
}
