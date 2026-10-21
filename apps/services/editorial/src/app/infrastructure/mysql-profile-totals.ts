import type { DataSource } from 'typeorm';
import type {
  ProfileContentCategory,
  ProfileContentTotals,
} from '@domains/customer/profiles';
import type { PublicationTotalsSource } from '../application/profile-totals';
import { MysqlSuiteCatalog } from '../suites/mysql-suite-catalog';
import { MysqlArticleCatalog } from '../articles/mysql-article-catalog';

/** Canonical publication counts do not depend on disposable content projections. */
export class MysqlPublicationTotals implements PublicationTotalsSource {
  constructor(
    private readonly source: DataSource,
    private readonly tenant: string
  ) {}
  async read(
    ownerIdentityId: string,
    categories: readonly ProfileContentCategory[]
  ) {
    const result: ProfileContentTotals = {};
    if (categories.includes('suites'))
      result.suites = (
        await new MysqlSuiteCatalog(this.source, this.tenant).select({
          ownerIdentityId,
          after: null,
        })
      ).total;
    if (categories.includes('articles'))
      result.articles = (
        await new MysqlArticleCatalog(this.source, this.tenant).select({
          ownerIdentityId,
        })
      ).total;
    return result;
  }
}
