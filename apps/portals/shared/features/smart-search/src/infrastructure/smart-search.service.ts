import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { ISmartSearchResultsProvider, ISmartSearchResult } from '../application/smart-search.interface';

@Injectable({
  providedIn: 'root'
})
export class SmartSearchApiService implements ISmartSearchResultsProvider {
  private recentSearches: ISmartSearchResult = {
    itemsNumber: 0,
    groups: [
      {
        id: 1,
        name: "Recent Searches",
        entries: [
          { id: 1, groupId: 1, name: "Angular", description: "Latest Angular applications", type: "app" },
          { id: 2, groupId: 1, name: "React", description: "React-based applications", type: "app" },
          { id: 3, groupId: 1, name: "Vue.js", description: "Vue.js applications", type: "app" }
        ]
      }
    ]
  };

  getRecentSearches(): ISmartSearchResult {
    return this.recentSearches;
  }

  search(query: string): Observable<ISmartSearchResult> {
    // Mock search implementation
    const mockResults: ISmartSearchResult = {
      itemsNumber: Math.floor(Math.random() * 100) + 1,
      groups: [
        {
          id: 1,
          name: "Applications",
          category: "apps",
          relevanceScore: 0.95,
          entries: [
            { 
              id: 1, 
              groupId: 1, 
              name: `${query} App`, 
              description: `A great ${query} application`, 
              type: "app",
              relevanceScore: 0.95,
              metadata: { downloads: 1000, rating: 4.5 }
            },
            { 
              id: 2, 
              groupId: 1, 
              name: `${query} Pro`, 
              description: `Professional ${query} tool`, 
              type: "app",
              relevanceScore: 0.88,
              metadata: { downloads: 500, rating: 4.2 }
            }
          ]
        },
        {
          id: 2,
          name: "Categories",
          category: "categories",
          relevanceScore: 0.80,
          entries: [
            { 
              id: 3, 
              groupId: 2, 
              name: `${query} Development`, 
              description: `Development tools for ${query}`, 
              type: "category",
              relevanceScore: 0.80
            }
          ]
        }
      ],
      suggestions: [
        `${query} tutorial`,
        `${query} examples`,
        `${query} best practices`,
        `${query} documentation`
      ]
    };

    return of(mockResults).pipe(delay(500)); // Simulate network delay
  }

  buildSearchString(p: { get: (key: string) => string | null }): string | null {
    return p.get('q') || null;
  }

  getSuggestions(partialQuery: string): Observable<string[]> {
    const suggestions = [
      `${partialQuery} app`,
      `${partialQuery} tool`,
      `${partialQuery} library`,
      `${partialQuery} framework`,
      `${partialQuery} tutorial`
    ].filter(s => s.toLowerCase().includes(partialQuery.toLowerCase()));

    return of(suggestions).pipe(delay(200));
  }

  getSmartRecommendations(): Observable<ISmartSearchResult> {
    const recommendations: ISmartSearchResult = {
      itemsNumber: 0,
      groups: [
        {
          id: 1,
          name: "Trending",
          category: "trending",
          entries: [
            { id: 1, groupId: 1, name: "Angular 17", description: "Latest Angular features", type: "app" },
            { id: 2, groupId: 1, name: "React 18", description: "New React capabilities", type: "app" },
            { id: 3, groupId: 1, name: "Vue 3", description: "Composition API", type: "app" }
          ]
        },
        {
          id: 2,
          name: "Popular Categories",
          category: "categories",
          entries: [
            { id: 4, groupId: 2, name: "Web Development", description: "Frontend and backend tools", type: "category" },
            { id: 5, groupId: 2, name: "Mobile Apps", description: "iOS and Android applications", type: "category" },
            { id: 6, groupId: 2, name: "DevOps", description: "Deployment and monitoring tools", type: "category" }
          ]
        }
      ]
    };

    return of(recommendations).pipe(delay(300));
  }
}