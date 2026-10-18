import { classificationFields } from '@domains/publication/classification';
import type { DataSource } from 'typeorm';
import {
  parseFavoriteTarget,
  parseFavoriteUpdateState,
  type FavoriteTarget,
} from '@domains/customer/favorites';
import type { FavoriteUpdateSource } from '@wapps/account';
import { canonicalArticle } from '../articles/mysql-article-state';
import { applicationPublicState } from '../application-publication/application-public-state';
import { suitePublicState } from '../suites/suite-publication-state';

export class MysqlEditorialFavoriteUpdates implements FavoriteUpdateSource {
  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string
  ) {}
  read(input: FavoriteTarget) {
    const target = parseFavoriteTarget(input);
    if (target.kind === 'discussions')
      throw new Error('Unsupported Editorial target');
    return this.source.transaction('REPEATABLE READ', async (tx) => {
      const [cursor]: Record<string, unknown>[] = await tx.query(
        'SELECT version,updatedAt FROM content_update_cursors WHERE targetKind=? AND targetId=?',
        [target.kind, target.id]
      );
      let content: unknown = null;
      if (target.kind === 'applications') {
        const state = await applicationPublicState(tx, target.id);
        if (
          state &&
          state.tenantId === this.publicTenant &&
          state.deletedAt === null &&
          state.isSuspended === 0
        ) {
          const [app]: Record<string, unknown>[] = await tx.query(
            'SELECT name,slug,classification FROM app_records WHERE id=?',
            [target.id]
          );
          if (!app) throw new Error('Application authority is incomplete');
          content = {
            title: app.name,
            ...classificationFields(app.classification ?? undefined),
            destination: { kind: target.kind, slug: app.slug },
          };
        }
      } else if (target.kind === 'articles') {
        const article = await canonicalArticle(tx, target.id);
        if (
          article &&
          article.tenantId === this.publicTenant &&
          article.deletedAt === null
        )
          content = {
            title: article.fields.title,
            ...classificationFields(article.fields.classification),
            destination: { kind: target.kind, slug: article.fields.slug },
          };
      } else {
        const state = await suitePublicState(tx, target.id);
        if (
          state &&
          state.tenantId === this.publicTenant &&
          state.deletedAt === null
        ) {
          const [suite]: Record<string, unknown>[] = await tx.query(
            'SELECT title,classification FROM suite_publications WHERE suiteId=?',
            [target.id]
          );
          if (!suite) throw new Error('Suite authority is incomplete');
          content = {
            title: suite.title,
            ...classificationFields(suite.classification ?? undefined),
            destination: { kind: target.kind },
          };
        }
      }
      return parseFavoriteUpdateState({
        target,
        version: cursor ? Number(cursor.version) : 0,
        at: cursor ? Number(cursor.updatedAt) : 0,
        content,
      });
    });
  }
}
