import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

// =========================
// Strapi Response Types
// =========================

export interface StrapiAppRecord {
  id: number;
  attributes: {
    name: string;
    slug: string;
    description: string;
    website: string;
    isPwa: boolean;
    rating: number;
    isSuspended: boolean;
    estimatedNumberOfUsers?: number;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
    logo?: {
      data?: {
        attributes: {
          url: string;
          alternativeText?: string;
        };
      };
    };
    banner?: {
      data?: {
        attributes: {
          url: string;
        };
      };
    };
    screenshots?: {
      data?: Array<{
        attributes: {
          url: string;
        };
      }>;
    };
    category?: {
      data?: {
        id: number;
        attributes: {
          name: string;
          slug: string;
        };
      };
    };
    tags?: {
      data: Array<{
        id: number;
        attributes: {
          name: string;
          slug: string;
        };
      }>;
    };
    organizationProfile?: {
      data?: {
        id: number;
        attributes: {
          name: string;
        };
      };
    };
    platforms?: {
      data: Array<{
        id: number;
        attributes: {
          platformId: string;
        };
      }>;
    };
    devices?: {
      data: Array<{
        id: number;
        attributes: {
          deviceId: string;
        };
      }>;
    };
  };
}

export interface StrapiCategory {
  id: number;
  attributes: {
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
    parentCategory?: {
      data?: {
        id: number;
        attributes: {
          name: string;
          slug: string;
        };
      };
    };
    childCategories?: {
      data: Array<{
        id: number;
        attributes: {
          name: string;
          slug: string;
        };
      }>;
    };
  };
}

export interface StrapiTag {
  id: number;
  attributes: {
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
  };
}

interface StrapiResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

interface StrapiSingleResponse<T> {
  data: T[];
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

  async getAppRecordBySlug(slug: string): Promise<StrapiAppRecord | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<StrapiSingleResponse<StrapiAppRecord>>(
          `${this.baseUrl}/api/app-records`,
          {
            params: {
              'filters[slug][$eq]': slug,
              'filters[isSuspended][$eq]': false,
              populate: 'deep,3',
            },
            headers: this.getHeaders(),
          }
        )
      );

      return response.data.data[0] || null;
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
    data: StrapiAppRecord[];
    meta: { page: number; pageSize: number; total: number; pageCount: number };
  }> {
    try {
      const params: Record<string, unknown> = {
        'pagination[page]': filters.page,
        'pagination[pageSize]': filters.pageSize,
        populate: 'deep,3',
        'filters[isSuspended][$eq]': false,
        'sort[0]': 'publishedAt:desc',
      };

      if (filters.category) {
        params['filters[category][slug][$eq]'] = filters.category;
      }

      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach((tag, index) => {
          params[`filters[tags][slug][$in][${index}]`] = tag;
        });
      }

      if (filters.search) {
        params['filters[$or][0][name][$containsi]'] = filters.search;
        params['filters[$or][1][description][$containsi]'] = filters.search;
      }

      const response = await firstValueFrom(
        this.httpService.get<StrapiResponse<StrapiAppRecord>>(
          `${this.baseUrl}/api/app-records`,
          {
            params,
            headers: this.getHeaders(),
          }
        )
      );

      return {
        data: response.data.data,
        meta: {
          page: response.data.meta.pagination.page,
          pageSize: response.data.meta.pagination.pageSize,
          total: response.data.meta.pagination.total,
          pageCount: response.data.meta.pagination.pageCount,
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

  async getCategories(): Promise<StrapiCategory[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<StrapiResponse<StrapiCategory>>(
          `${this.baseUrl}/api/categories`,
          {
            params: {
              populate: 'parentCategory,childCategories',
              'pagination[pageSize]': 100,
            },
            headers: this.getHeaders(),
          }
        )
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch categories', error);
      throw error;
    }
  }

  // =========================
  // Tags
  // =========================

  async getTags(): Promise<StrapiTag[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<StrapiResponse<StrapiTag>>(
          `${this.baseUrl}/api/tags`,
          {
            params: {
              'pagination[pageSize]': 100,
            },
            headers: this.getHeaders(),
          }
        )
      );

      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to fetch tags', error);
      throw error;
    }
  }

  async getTagBySlug(slug: string): Promise<StrapiTag | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<StrapiSingleResponse<StrapiTag>>(
          `${this.baseUrl}/api/tags`,
          {
            params: {
              'filters[slug][$eq]': slug,
            },
            headers: this.getHeaders(),
          }
        )
      );

      return response.data.data[0] || null;
    } catch (error) {
      this.logger.error(`Failed to fetch tag by slug: ${slug}`, error);
      throw error;
    }
  }
}

