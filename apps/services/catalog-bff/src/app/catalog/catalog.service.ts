import { Injectable, Logger } from '@nestjs/common';
import { EditorialClient, EditorialAppRecord, EditorialCategory, EditorialTag } from './clients/editorial.client';
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
      const editorialRecord = await this.editorialClient.getAppRecordBySlug(slug);
      if (!editorialRecord) return null;

      const record = this.composeAppRecord(editorialRecord);
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
      const editorialRecord = await this.editorialClient.getAppRecordBySlug(slug);
      if (!editorialRecord) return null;

      const record = this.composeAppRecord(editorialRecord);
      await this.enrichRecord(record);

      return this.mapToResponseDto(record, editorialRecord);
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
        data.map(async (editorialRecord) => {
          const record = this.composeAppRecord(editorialRecord);
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
        data.map(async (editorialRecord) => {
          const record = this.composeAppRecord(editorialRecord);
          await this.enrichRecord(record);
          return this.mapToResponseDto(record, editorialRecord);
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
      const editorialRecord = await this.editorialClient.getAppRecordBySlug(slug);
      if (!editorialRecord) return null;

      return this.composeAppPreview(editorialRecord);
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
      const editorialCategories = await this.editorialClient.getCategories();
      const categories = editorialCategories.map((ec) => this.composeCategoryDto(ec));
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
      const editorialTags = await this.editorialClient.getTags();
      return editorialTags.map((et) => this.composeTagDto(et));
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
      const editorialTag = await this.editorialClient.getTagBySlug(slug);
      if (!editorialTag) return null;
      return this.composeTagDto(editorialTag);
    } catch (error) {
      this.logger.error(`Failed to get tag for slug: ${slug}`, error);
      throw error;
    }
  }

  // =========================
  // Private Composition Methods
  // =========================

  /**
   * Transform Editorial AppRecord → Domain AppRecordDto
   */
  private composeAppRecord(editorial: EditorialAppRecord): AppRecordDto {
    return {
      id: this.convertIdToNumber(editorial.id),
      slug: editorial.slug,
      name: editorial.name,
      description: editorial.description || '',
      logo: editorial.logoUrl || '',
      rating: editorial.rating || 0,
      tagIds: editorial.tags?.map((t) => this.convertIdToNumber(t.id)) || [],
      categoryId: editorial.category ? this.convertIdToNumber(editorial.category.id) : 0,
      platformIds: this.extractPlatformIds(editorial),
      reviewNumber: 0, // Will be enriched
      updateTimestamp: new Date(editorial.updatedAt).getTime(),
      creationTimestamp: new Date(editorial.createdAt).getTime(),
      updateDate: new Date(editorial.updatedAt),
      listingDate: new Date(editorial.createdAt),
    };
  }

  /**
   * Transform Editorial AppRecord → Domain AppPreviewDto
   */
  private composeAppPreview(editorial: EditorialAppRecord): AppPreviewDto {
    return {
      id: this.convertIdToNumber(editorial.id),
      slug: editorial.slug,
      name: editorial.name,
      logo: editorial.logoUrl || '',
      isPwa: editorial.isPwa || false,
      rating: editorial.rating || 0,
      reviews: 0, // Placeholder - would come from reviews service
      tagIds: editorial.tags?.map((t) => this.convertIdToNumber(t.id)) || [],
      categoryId: editorial.category ? this.convertIdToNumber(editorial.category.id) : 0,
      platformIds: this.extractPlatformIds(editorial),
    };
  }

  /**
   * Transform Editorial Category → Domain CategoryDto
   */
  private composeCategoryDto(editorial: EditorialCategory): CategoryDto {
    return {
      id: this.convertIdToNumber(editorial.id),
      name: editorial.name,
      slug: editorial.slug,
      parentId: editorial.parent ? this.convertIdToNumber(editorial.parent.id) : null,
      rootId: null, // Will be computed
      depth: 0, // Will be computed
    };
  }

  /**
   * Transform Editorial Tag → Domain TagDto
   */
  private composeTagDto(editorial: EditorialTag): TagDto {
    return {
      id: this.convertIdToNumber(editorial.id),
      slug: editorial.slug,
      name: editorial.name,
    };
  }

  // =========================
  // Private Helper Methods
  // =========================

  /**
   * Convert UUID string to numeric ID for domain models
   * Uses a hash function to generate consistent numeric IDs from UUIDs
   */
  private convertIdToNumber(uuid: string): number {
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
      const char = uuid.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Extract platform IDs from associations
   */
  private extractPlatformIds(editorial: EditorialAppRecord): number[] {
    if (!editorial.platforms || editorial.platforms.length === 0) {
      return [];
    }

    // Map platform slugs to numeric IDs
    const platformMap: Record<string, number> = {
      web: 1,
      ios: 2,
      android: 3,
      windows: 4,
      linux: 5,
      macos: 6,
    };

    return editorial.platforms
      .map((p) => platformMap[p.slug.toLowerCase()] || 0)
      .filter((id) => id !== 0);
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
        const cached = this.categoryMetadataCache.get(category.id);
        if (cached) {
          category.depth = cached.depth;
          category.rootId = cached.rootId;
          return;
        }
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
      const node = categoryMap.get(cat.id);
      if (!node) return;

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
   * Map AppRecordDto + EditorialAppRecord to AppRecordResponseDto
   */
  private mapToResponseDto(record: AppRecordDto, editorial: EditorialAppRecord): AppRecordResponseDto {
    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      description: record.description,
      logo: record.logo,
      isPwa: editorial.isPwa || false,
      rating: editorial.rating || 0,
      tagIds: record.tagIds,
      categoryId: record.categoryId,
      platformIds: record.platformIds,
      reviewNumber: record.reviewNumber,
      updateDate: new Date(editorial.updatedAt),
      listingDate: new Date(editorial.createdAt),
    };
  }
}

