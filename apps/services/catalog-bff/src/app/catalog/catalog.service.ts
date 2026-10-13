import {
  CatalogCategory,
  CatalogReadPort,
  CatalogReadQuery,
} from '@domains/catalog/record';

export interface CatalogCategoryTree extends CatalogCategory {
  childs: CatalogCategoryTree[];
}

export class CatalogService {
  constructor(private readonly catalog: CatalogReadPort) {}

  browse(query: CatalogReadQuery) {
    return this.catalog.browse(query);
  }
  find(slug: string) {
    return this.catalog.find(slug);
  }
  select(ids: string[]) {
    return this.catalog.select(ids);
  }
  facets() {
    return this.catalog.facets();
  }

  async categoryTree(): Promise<CatalogCategoryTree[]> {
    const { categories } = await this.catalog.facets();
    const nodes = new Map<string, CatalogCategoryTree>(
      categories.map((category) => [category.id, { ...category, childs: [] }])
    );
    const roots: CatalogCategoryTree[] = [];
    for (const category of nodes.values()) {
      if (category.parentId === null) roots.push(category);
      else nodes.get(category.parentId)?.childs.push(category);
    }
    return roots;
  }
}
