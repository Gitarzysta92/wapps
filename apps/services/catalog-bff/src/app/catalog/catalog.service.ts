import { Injectable, Logger } from '@nestjs/common';
import { EditorialClient, StrapiAppRecord, StrapiCategory, StrapiTag } from './clients/editorial.client';
import { AppRecordDto, AppPreviewDto } from '@domains/catalog/record';
import { CategoryDto, CategoryTreeDto } from '@domains/catalog/category';
import { TagDto } from '@domains/catalog/tags';
import { AppRecordResponseDto } from './dto/app-record.dto';

interface GetAppsFilters {
  page: number;
  pageSize: number;
  category?: string;
  tags?: string[];
  search?: string;
}

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  // In-memory cache for lazy-loaded computed data
  private readonly recordEnrichmentCache = new Map<
    string,
    {
      reviewNumber: number;
      lastChecked: Date;
    }
  >();

  private readonly categoryMetadataCache = new Map<
    number,
    {
      depth: number;
      rootId: number | null;
    }
  >();

  constructor(private readonly editorialClient: EditorialClient) {}

  /**
   * Composes AppRecordDto from Editorial (Strapi) data
   * Enriches with lazy-loaded computed fields
   */
  async getAppRecord(slug: string): Promise<AppRecordDto | null> {
    try {
      const strapiRecord = await this.editorialClient.getAppRecordBySlug(slug);
      if (!strapiRecord) return null;

      const record = this.composeAppRecord(strapiRecord);
      await this.enrichRecord(record);

      return record;
    } catch (error) {
      this.logger.error(`Failed to get app record for slug: ${slug}`, error);
      throw error;
    }
  }

  /**
   * Get app record as response DTO (includes isPwa, rating, dates)
   */
  async getAppRecordResponse(slug: string): Promise<AppRecordResponseDto | null> {
    try {
      const strapiRecord = await this.editorialClient.getAppRecordBySlug(slug);
      if (!strapiRecord) return null;

      const record = this.composeAppRecord(strapiRecord);
      await this.enrichRecord(record);

      return this.mapToResponseDto(record, strapiRecord);
    } catch (error) {
      this.logger.error(`Failed to get app record response for slug: ${slug}`, error);
      throw error;
    }
  }

  /**
   * Get app records with pagination and filtering
   */
  async getAppRecords(filters: GetAppsFilters): Promise<PaginatedResult<AppRecordDto>> {
    try {
      const { data, meta } = await this.editorialClient.getAppRecords(filters);

      const records = await Promise.all(
        data.map(async (strapiRecord) => {
          const record = this.composeAppRecord(strapiRecord);
          await this.enrichRecord(record);
          return record;
        })
      );

      return { data: records, meta };
    } catch (error) {
      this.logger.error('Failed to get app records', error);
      throw error;
    }
  }

  /**
   * Get app records as response DTOs with pagination and filtering
   */
  async getAppRecordsResponse(filters: GetAppsFilters): Promise<PaginatedResult<AppRecordResponseDto>> {
    try {
      const { data, meta } = await this.editorialClient.getAppRecords(filters);

      const records = await Promise.all(
        data.map(async (strapiRecord) => {
          const record = this.composeAppRecord(strapiRecord);
          await this.enrichRecord(record);
          return this.mapToResponseDto(record, strapiRecord);
        })
      );

      return { data: records, meta };
    } catch (error) {
      this.logger.error('Failed to get app records response', error);
      throw error;
    }
  }

  /**
   * Get app preview (lighter version for listings)
   */
  async getAppPreview(slug: string): Promise<AppPreviewDto | null> {
    try {
      const strapiRecord = await this.editorialClient.getAppRecordBySlug(slug);
      if (!strapiRecord) return null;

      return this.composeAppPreview(strapiRecord);
    } catch (error) {
      this.logger.error(`Failed to get app preview for slug: ${slug}`, error);
      throw error;
    }
  }

  /**
   * Get categories with computed metadata (depth, rootId)
   */
  async getCategories(): Promise<CategoryDto[]> {
    try {
      const strapiCategories = await this.editorialClient.getCategories();
      const categories = strapiCategories.map((sc) => this.composeCategoryDto(sc));
      this.computeCategoryMetadata(categories);
      return categories;
    } catch (error) {
      this.logger.error('Failed to get categories', error);
      throw error;
    }
  }

  /**
   * Build category tree structure
   */
  async getCategoryTree(): Promise<CategoryTreeDto[]> {
    const categories = await this.getCategories();
    return this.buildCategoryTree(categories);
  }

  /**
   * Get all tags
   */
  async getTags(): Promise<TagDto[]> {
    try {
      const strapiTags = await this.editorialClient.getTags();
      return strapiTags.map((st) => this.composeTagDto(st));
    } catch (error) {
      this.logger.error('Failed to get tags', error);
      throw error;
    }
  }

  /**
   * Get single tag by slug
   */
  async getTag(slug: string): Promise<TagDto | null> {
    try {
      const strapiTag = await this.editorialClient.getTagBySlug(slug);
      if (!strapiTag) return null;
      return this.composeTagDto(strapiTag);
    } catch (error) {
      this.logger.error(`Failed to get tag for slug: ${slug}`, error);
      throw error;
    }
  }

  // =========================
  // Private Composition Methods
  // =========================

  /**
   * Transform Strapi AppRecord → Domain AppRecordDto
   */
  private composeAppRecord(strapi: StrapiAppRecord): AppRecordDto {
    const attrs = strapi.attributes;

    return {
      id: strapi.id,
      slug: attrs.slug,
      name: attrs.name,
      description: attrs.description || '',
      logo: attrs.logo?.data?.attributes?.url || '',
      rating: attrs.rating || 0,
      tagIds: attrs.tags?.data?.map((t) => t.id) || [],
      categoryId: attrs.category?.data?.id || 0,
      platformIds: this.extractPlatformIds(attrs),
      reviewNumber: 0, // Will be enriched
      updateTimestamp: new Date(attrs.updatedAt).getTime(),
      creationTimestamp: new Date(attrs.publishedAt || attrs.createdAt).getTime(),
      updateDate: new Date(attrs.updatedAt),
      listingDate: new Date(attrs.publishedAt || attrs.createdAt),
    };
  }

  /**
   * Transform Strapi AppRecord → Domain AppPreviewDto
   */
  private composeAppPreview(strapi: StrapiAppRecord): AppPreviewDto {
    const attrs = strapi.attributes;

    return {
      id: strapi.id,
      slug: attrs.slug,
      name: attrs.name,
      logo: attrs.logo?.data?.attributes?.url || '',
      isPwa: attrs.isPwa || false,
      rating: attrs.rating || 0,
      reviews: 0, // Placeholder - would come from reviews service
      tagIds: attrs.tags?.data?.map((t) => t.id) || [],
      categoryId: attrs.category?.data?.id || 0,
      platformIds: this.extractPlatformIds(attrs),
    };
  }

  /**
   * Transform Strapi Category → Domain CategoryDto
   */
  private composeCategoryDto(strapi: StrapiCategory): CategoryDto {
    const attrs = strapi.attributes;

    return {
      id: strapi.id,
      name: attrs.name,
      slug: attrs.slug,
      parentId: attrs.parentCategory?.data?.id || null,
      rootId: null, // Will be computed
      depth: 0, // Will be computed
    };
  }

  /**
   * Transform Strapi Tag → Domain TagDto
   */
  private composeTagDto(strapi: StrapiTag): TagDto {
    return {
      id: strapi.id,
      slug: strapi.attributes.slug,
      name: strapi.attributes.name,
    };
  }

  // =========================
  // Private Helper Methods
  // =========================

  /**
   * Extract platform IDs from associations
   */
  private extractPlatformIds(attrs: StrapiAppRecord['attributes']): number[] {
    // Extract from platform associations if populated
    if (attrs.platforms?.data) {
      return attrs.platforms.data.map((p) => {
        const platformMap: Record<string, number> = {
          Web: 1,
          IOS: 2,
          Android: 3,
          Windows: 4,
          Linux: 5,
          MacOS: 6,
        };
        return platformMap[p.attributes.platformId] || 0;
      });
    }
    return [];
  }

  /**
   * Lazy enrich record with computed/aggregated data
   * Future: call reviews service, analytics service, etc.
   */
  private async enrichRecord(record: AppRecordDto): Promise<void> {
    const cached = this.recordEnrichmentCache.get(record.slug);
    const cacheMaxAge = 5 * 60 * 1000; // 5 minutes

    if (cached && Date.now() - cached.lastChecked.getTime() < cacheMaxAge) {
      record.reviewNumber = cached.reviewNumber;
      return;
    }

    // Mock review number computation
    // Future: Replace with actual reviews service call
    const reviewNumber = this.computeReviewNumber(record);

    this.recordEnrichmentCache.set(record.slug, {
      reviewNumber,
      lastChecked: new Date(),
    });

    record.reviewNumber = reviewNumber;
  }

  /**
   * Mock review number computation
   * TODO: Replace with actual reviews service call
   */
  private computeReviewNumber(record: AppRecordDto): number {
    // Temporary mock: generate a pseudo-random number based on slug
    // This will be replaced with actual reviews service call
    let hash = 0;
    for (let i = 0; i < record.slug.length; i++) {
      const char = record.slug.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash % 1000); // Return a number between 0 and 999
  }

  /**
   * Compute depth and rootId for category tree
   */
  private computeCategoryMetadata(categories: CategoryDto[]): void {
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    categories.forEach((category) => {
      if (this.categoryMetadataCache.has(category.id)) {
        const cached = this.categoryMetadataCache.get(category.id)!;
        category.depth = cached.depth;
        category.rootId = cached.rootId;
        return;
      }

      let depth = 0;
      let rootId = category.id;
      let current = category;

      while (current.parentId !== null) {
        depth++;
        const parent = categoryMap.get(current.parentId);
        if (!parent) break;
        rootId = parent.id;
        current = parent;
      }

      category.depth = depth;
      category.rootId = rootId;

      this.categoryMetadataCache.set(category.id, { depth, rootId });
    });
  }

  /**
   * Build tree structure from flat category list
   */
  private buildCategoryTree(categories: CategoryDto[]): CategoryTreeDto[] {
    const categoryMap = new Map<number, CategoryTreeDto>();
    const roots: CategoryTreeDto[] = [];

    // Create nodes
    categories.forEach((cat) => {
      categoryMap.set(cat.id, {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        childs: [],
      });
    });

    // Build tree
    categories.forEach((cat) => {
      const node = categoryMap.get(cat.id)!;

      if (cat.parentId === null) {
        roots.push(node);
      } else {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.childs.push(node);
        }
      }
    });

    return roots;
  }

  /**
   * Map AppRecordDto + StrapiAppRecord to AppRecordResponseDto
   */
  private mapToResponseDto(record: AppRecordDto, strapi: StrapiAppRecord): AppRecordResponseDto {
    const attrs = strapi.attributes;
    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      description: record.description,
      logo: record.logo,
      isPwa: attrs.isPwa || false,
      rating: attrs.rating || 0,
      tagIds: record.tagIds,
      categoryId: record.categoryId,
      platformIds: record.platformIds,
      reviewNumber: record.reviewNumber,
      updateDate: new Date(attrs.updatedAt),
      listingDate: new Date(attrs.publishedAt || attrs.createdAt),
    };
  }
}

