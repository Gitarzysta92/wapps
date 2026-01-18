import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { CATALOG_API_URL } from './catalog-api-url.token';
import { AppRecordDto, PaginatedAppsResponse } from './catalog.dto';

@Injectable({
  providedIn: 'root'
})
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(CATALOG_API_URL);

  getApps(params?: {
    page?: number;
    pageSize?: number;
    category?: string;
    tags?: string[];
    search?: string;
  }): Observable<PaginatedAppsResponse<AppRecordDto>> {
    if (!this.apiUrl) {
      // Return mock data if no API URL is configured
      return of(this.getMockApps());
    }

    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.tags) queryParams.append('tags', params.tags.join(','));
    if (params?.search) queryParams.append('search', params.search);

    const url = `${this.apiUrl}/catalog/apps${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.http.get<PaginatedAppsResponse<AppRecordDto>>(url);
  }

  getAppBySlug(slug: string): Observable<AppRecordDto | null> {
    if (!this.apiUrl) {
      // Return mock data if no API URL is configured
      const mockApps = this.getMockApps();
      const app = mockApps.data.find(a => a.slug === slug);
      return of(app || null);
    }

    return this.http.get<AppRecordDto>(`${this.apiUrl}/catalog/apps/${slug}`);
  }

  private getMockApps(): PaginatedAppsResponse<AppRecordDto> {
    return {
      data: [
        {
          id: 1,
          slug: 'productivity-master',
          name: 'Productivity Master',
          description: 'A comprehensive productivity application with task management, time tracking, and collaboration features.',
          logo: 'https://via.placeholder.com/150',
          isPwa: true,
          rating: 4.5,
          tagIds: [1, 2, 3],
          categoryId: 1,
          platformIds: [1, 2],
          reviewNumber: 1234,
          updateDate: new Date('2025-01-15'),
          listingDate: new Date('2024-06-01'),
        },
        {
          id: 2,
          slug: 'code-editor-pro',
          name: 'Code Editor Pro',
          description: 'Advanced code editor with syntax highlighting, IntelliSense, and Git integration for professional developers.',
          logo: 'https://via.placeholder.com/150',
          isPwa: true,
          rating: 4.8,
          tagIds: [4, 5],
          categoryId: 2,
          platformIds: [1, 2, 3],
          reviewNumber: 2567,
          updateDate: new Date('2025-01-10'),
          listingDate: new Date('2024-03-15'),
        },
        {
          id: 3,
          slug: 'photo-studio',
          name: 'Photo Studio',
          description: 'Professional photo editing application with advanced filters, layers, and batch processing capabilities.',
          logo: 'https://via.placeholder.com/150',
          isPwa: false,
          rating: 4.2,
          tagIds: [6, 7],
          categoryId: 3,
          platformIds: [1, 2],
          reviewNumber: 890,
          updateDate: new Date('2025-01-12'),
          listingDate: new Date('2024-08-20'),
        },
        {
          id: 4,
          slug: 'fitness-tracker',
          name: 'Fitness Tracker',
          description: 'Track your workouts, monitor your progress, and achieve your fitness goals with personalized plans.',
          logo: 'https://via.placeholder.com/150',
          isPwa: true,
          rating: 4.6,
          tagIds: [8, 9],
          categoryId: 4,
          platformIds: [1, 2],
          reviewNumber: 3421,
          updateDate: new Date('2025-01-18'),
          listingDate: new Date('2024-01-10'),
        },
        {
          id: 5,
          slug: 'recipe-manager',
          name: 'Recipe Manager',
          description: 'Organize your recipes, plan meals, generate shopping lists, and discover new dishes.',
          logo: 'https://via.placeholder.com/150',
          isPwa: true,
          rating: 4.3,
          tagIds: [10, 11],
          categoryId: 5,
          platformIds: [1, 2],
          reviewNumber: 756,
          updateDate: new Date('2025-01-14'),
          listingDate: new Date('2024-09-05'),
        },
        {
          id: 6,
          slug: 'budget-planner',
          name: 'Budget Planner',
          description: 'Manage your finances with smart budgeting tools, expense tracking, and financial insights.',
          logo: 'https://via.placeholder.com/150',
          isPwa: true,
          rating: 4.7,
          tagIds: [12, 13],
          categoryId: 6,
          platformIds: [1, 2, 3],
          reviewNumber: 1892,
          updateDate: new Date('2025-01-16'),
          listingDate: new Date('2024-05-22'),
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 6,
        pageCount: 1,
      }
    };
  }
}
