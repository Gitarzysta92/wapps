import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

// =========================
// Editorial API Response Types
// =========================

export interface EditorialAppRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  isPwa: boolean;
  rating: number | null;
  isSuspended: boolean;
  estimatedNumberOfUsers: number | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  createdAt: string;
  updatedAt: string;
  category: EditorialCategory | null;
  tags: EditorialTag[];
  platforms: EditorialPlatform[];
  devices: EditorialDevice[];
  monetizationModels: EditorialMonetizationModel[];
}

export interface EditorialCategory {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  parent: EditorialCategory | null;
  children: EditorialCategory[];
}

export interface EditorialTag {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface EditorialPlatform {
  id: string;
  name: string;
  slug: string;
}

export interface EditorialDevice {
  id: string;
  name: string;
  slug: string;
}

export interface EditorialMonetizationModel {
  id: string;
  name: string;
  slug: string;
}

// =========================
// Editorial Client
// =========================

@Injectable()
export class EditorialClient {
  private readonly logger = new Logger(EditorialClient.name);
  private readonly baseUrl: string;
  private readonly apiToken?: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    const editorialUrl = this.configService.get<string>('EDITORIAL_URL');
    if (!editorialUrl) {
      throw new Error('EDITORIAL_URL environment variable is required');
    }
    this.baseUrl = editorialUrl;
    this.apiToken = this.configService.get<string>('EDITORIAL_API_TOKEN');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    return headers;
  }

  // =========================
  // App Records
  // =========================

  async getAppRecordBySlug(slug: string): Promise<EditorialAppRecord | null> {
    try {
      // Editorial API returns all records, we need to filter by slug client-side
      // TODO: Add slug-based endpoint to editorial service for better performance
      const response = await firstValueFrom(
        this.httpService.get<EditorialAppRecord[]>(
          `${this.baseUrl}/api/apps`,
          {
            headers: this.getHeaders(),
          }
        )
      );

      const record = response.data.find(
        (app) => app.slug === slug && !app.isSuspended
      );

      return record || null;
    } catch (error) {
      this.logger.error(`Failed to fetch app record by slug: ${slug}`, error);
      throw error;
    }
  }

  async getAppRecords(filters: {
    page: number;
    pageSize: number;
    category?: string;
    tags?: string[];
    search?: string;
  }): Promise<{
    data: EditorialAppRecord[];
    meta: { page: number; pageSize: number; total: number; pageCount: number };
  }> {
    try {
      // Editorial API doesn't support filtering/pagination yet
      // We'll implement client-side filtering and pagination
      // TODO: Add filtering and pagination support to editorial service
      const response = await firstValueFrom(
        this.httpService.get<EditorialAppRecord[]>(
          `${this.baseUrl}/api/apps`,
          {
            headers: this.getHeaders(),
          }
        )
      );

      let filteredData = response.data.filter((app) => !app.isSuspended);

      // Apply category filter
      if (filters.category) {
        filteredData = filteredData.filter(
          (app) => app.category?.slug === filters.category
        );
      }

      // Apply tags filter
      if (filters.tags && filters.tags.length > 0) {
        const tagsToFilter = filters.tags;
        filteredData = filteredData.filter((app) =>
          tagsToFilter.some((tagSlug) =>
            app.tags.some((tag) => tag.slug === tagSlug)
          )
        );
      }

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(
          (app) =>
            app.name.toLowerCase().includes(searchLower) ||
            app.description?.toLowerCase().includes(searchLower)
        );
      }

      // Sort by updatedAt desc
      filteredData.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      // Apply pagination
      const total = filteredData.length;
      const pageCount = Math.ceil(total / filters.pageSize);
      const startIndex = (filters.page - 1) * filters.pageSize;
      const endIndex = startIndex + filters.pageSize;
      const paginatedData = filteredData.slice(startIndex, endIndex);

      return {
        data: paginatedData,
        meta: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          pageCount,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch app records', error);
      throw error;
    }
  }

  // =========================
  // Categories
  // =========================

  async getCategories(): Promise<EditorialCategory[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<EditorialCategory[]>(
          `${this.baseUrl}/api/categories`,
          {
            headers: this.getHeaders(),
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch categories', error);
      throw error;
    }
  }

  // =========================
  // Tags
  // =========================

  async getTags(): Promise<EditorialTag[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<EditorialTag[]>(
          `${this.baseUrl}/api/tags`,
          {
            headers: this.getHeaders(),
          }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch tags', error);
      throw error;
    }
  }

  async getTagBySlug(slug: string): Promise<EditorialTag | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<EditorialTag[]>(
          `${this.baseUrl}/api/tags`,
          {
            headers: this.getHeaders(),
          }
        )
      );

      const tag = response.data.find((t) => t.slug === slug);
      return tag || null;
    } catch (error) {
      this.logger.error(`Failed to fetch tag by slug: ${slug}`, error);
      throw error;
    }
  }
}

