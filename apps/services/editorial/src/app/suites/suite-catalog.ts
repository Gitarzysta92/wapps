import {
  parsePublicSuite,
  parsePublicSuiteQuery,
  parsePublicSuiteSelection,
  publicSuiteSelectionIds,
  SuiteNotFoundError,
  SuiteUnavailableError,
  type PublicSuite,
  type PublicSuiteQuery,
  profileSuitesCursor,
  profileSuitesPage,
} from '@domains/publication/suite';
import {
  inspectEditorialProjection,
  type EditorialProjectionStore,
} from '../application/editorial-materialization';

export interface SuiteCatalogSelection {
  tenantId: string;
  total: number;
  items: {
    id: string;
    revision: number;
    submittedRevision: number;
    publishedAt: number;
  }[];
}
export interface SuiteCatalogAuthority {
  select(query: SuiteCatalogQuery): Promise<SuiteCatalogSelection>;
}

export type SuiteCatalogQuery =
  | PublicSuiteQuery
  | { id: string }
  | { ids: string[] }
  | { ownerIdentityId: string; after: string | null };

export class SuiteCatalog {
  constructor(
    private readonly authority: SuiteCatalogAuthority,
    private readonly projections: Pick<EditorialProjectionStore, 'find'>
  ) {}
  async browse(input: PublicSuiteQuery) {
    const query = parsePublicSuiteQuery({
      ...input,
      page: String(input.page),
      ...(input.pageSize === undefined
        ? {}
        : { pageSize: String(input.pageSize) }),
    });
    const { items, total } = await this.read(query);
    return {
      items,
      total,
      page: query.page,
      ...(query.pageSize === undefined ? {} : { pageSize: query.pageSize }),
    };
  }
  async find(id: string) {
    const { items } = await this.read({ id });
    if (!items[0]) throw new SuiteNotFoundError('Suite not found');
    return items[0];
  }
  async select(input: readonly string[]) {
    const ids = publicSuiteSelectionIds(input);
    const { items } = await this.read({ ids });
    return parsePublicSuiteSelection({ items }, ids);
  }
  async profile(ownerIdentityId: string, after: string | null) {
    const { items } = await this.read({
      ownerIdentityId,
      after: profileSuitesCursor(after),
    });
    return profileSuitesPage(
      items.map(({ id, title, description }) => ({ id, title, description })),
      after
    );
  }
  private async read(query: SuiteCatalogQuery) {
    try {
      const selected = await this.authority.select(query);
      const items: PublicSuite[] = [];
      for (let offset = 0; offset < selected.items.length; offset += 10) {
        items.push(
          ...(await Promise.all(
            selected.items.slice(offset, offset + 10).map(async (expected) => {
              const projection = inspectEditorialProjection(
                await this.projections.find('suite', expected.id)
              );
              if (
                projection.kind !== 'suite' ||
                projection.resourceId !== expected.id ||
                projection.tenantId !== selected.tenantId ||
                projection.revision !== expected.revision ||
                projection.deletedAt !== null ||
                !projection.content ||
                !('submittedRevision' in projection.content) ||
                projection.content.submittedRevision !==
                  expected.submittedRevision ||
                projection.content.publishedAt !== expected.publishedAt
              )
                throw new SuiteUnavailableError(
                  'Suite publication is updating. Try again shortly.'
                );
              return parsePublicSuite({
                ...projection.content,
                id: expected.id,
                revision: expected.revision,
              });
            })
          ))
        );
      }
      // A late withdrawal, deletion or replacement must invalidate the entire response.
      if (
        JSON.stringify(await this.authority.select(query)) !==
        JSON.stringify(selected)
      )
        throw new SuiteUnavailableError(
          'Suite publication changed while loading. Try again.'
        );
      return { items, total: selected.total };
    } catch (error) {
      if (error instanceof SuiteUnavailableError) throw error;
      throw new SuiteUnavailableError(
        'Suite catalog is unavailable. Try again shortly.'
      );
    }
  }
}
