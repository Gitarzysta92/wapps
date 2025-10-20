import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { FeedItemDto } from '@domains/feed';
import { IFeedItem, FeedItemPriority } from '../models/feed-item.interface';

import { ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR } from '../feed-items/article-highlight/article-highlight-feed-item.component';
import { APPLICATION_HEALTH_FEED_ITEM_SELECTOR } from '../feed-items/application-health/application-health-feed-item.component';

export interface INewsFeedPage {
  items: IFeedItem[];
  hasMore: boolean;
  nextPage?: number;
}

@Injectable()
export class NewsFeedService {
  private readonly _feedItems$ = new BehaviorSubject<IFeedItem[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(false);
  private readonly _hasMore$ = new BehaviorSubject<boolean>(true);
  
  private _currentPage = 0;
  private readonly _pageSize = 10;

  public readonly feedItems$ = this._feedItems$.asObservable();
  public readonly loading$ = this._loading$.asObservable();
  public readonly hasMore$ = this._hasMore$.asObservable();

  constructor() {
    // Load initial page
    this.loadNextPage();
  }

  public loadNextPage(): void {
    if (this._loading$.value || !this._hasMore$.value) {
      return;
    }

    this._loading$.next(true);

    // Simulate API call with delay
    this.getFeedPage(this._currentPage, this._pageSize)
      .subscribe(page => {
        const currentItems = this._feedItems$.value;
        const newItems = [...currentItems, ...page.items];
        
        this._feedItems$.next(newItems);
        this._hasMore$.next(page.hasMore);
        this._currentPage++;
        this._loading$.next(false);
      });
  }

  public refresh(): void {
    this._currentPage = 0;
    this._feedItems$.next([]);
    this._hasMore$.next(true);
    this.loadNextPage();
  }

  private getFeedPage(page: number, size: number): Observable<INewsFeedPage> {
    // Simulate API call - in real app, this would be an HTTP request
    const mockDtos = this.generateMockFeedItemDtos(page, size);
    const hasMore = page < 5; // Simulate 5 pages of data

    return of({
      items: mockDtos.map(dto => dto),
      hasMore,
      nextPage: hasMore ? page + 1 : undefined
    });
  }

  private generateMockFeedItemDtos(page: number, size: number): FeedItemDto[] {
    const items: FeedItemDto[] = [];
    const baseId = page * size;

    for (let i = 0; i < size; i++) {
      const itemId = baseId + i;
      const itemType = this.getRandomFeedItemType();
      
      items.push({
        id: `feed-item-${itemId}`,
        type: itemType,
        title: this.getRandomArticleTitle(),
        subtitle: this.getRandomAppName(),
        timestamp: new Date(Date.now() - (itemId * 2 * 60 * 60 * 1000)), // Each item 2 hours older
        params: {
          priority: this.mapPriorityToDomain(this.getRandomPriority()),
          ...this.generateMetadataForType(itemType, itemId)
        }
      });
    }

    return items;
  }

  private getRandomFeedItemType(): string {
    const types = [
      APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
      ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR
    ];
    return types[Math.floor(Math.random() * types.length)];
  }

  private getRandomPriority(): FeedItemPriority {
    const priorities = [
      FeedItemPriority.LOW,
      FeedItemPriority.MEDIUM,
      FeedItemPriority.MEDIUM, // More medium priority
      FeedItemPriority.HIGH,
    ];
    return priorities[Math.floor(Math.random() * priorities.length)];
  }

  private generateMetadataForType(type: string, itemId: number): Record<string, any> {
    switch (type) {
      case ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR:
        return {
          title: `Article ${itemId + 1}: ${this.getRandomArticleTitle()}`,
          excerpt: `This is a sample excerpt for article ${itemId + 1}. It provides a brief overview of the content and encourages readers to learn more.`,
          author: this.getRandomAuthor(),
          category: this.getRandomCategory(),
          coverImage: {
            url: "https://picsum.photos/800/200",
            alt: ""
          }
        };
      
      case APPLICATION_HEALTH_FEED_ITEM_SELECTOR:
        return {
          title: this.getRandomArticleTitle(),
          appName: this.getRandomAppName(),
          status: this.getRandomHealthStatus(),
          message: this.getRandomHealthMessage(),
          responseTime: Math.floor(Math.random() * 200) + 20
        };
      
      default:
        return {};
    }
  }

  private getRandomArticleTitle(): string {
    const titles = [
      'Advanced Angular Patterns',
      'Microservices Best Practices',
      'DevOps Automation Guide',
      'UI/UX Design Principles',
      'Database Optimization Tips',
      'Security Best Practices',
      'Performance Monitoring',
      'Cloud Architecture Patterns'
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  }

  private getRandomAuthor(): string {
    const authors = [
      'Tech Team',
      'DevOps Team',
      'Angular Team',
      'Security Team',
      'UI/UX Team',
      'Backend Team',
      'Frontend Team',
      'QA Team'
    ];
    return authors[Math.floor(Math.random() * authors.length)];
  }

  private getRandomCategory(): string {
    const categories = [
      'Technology',
      'Architecture',
      'Security',
      'Performance',
      'DevOps',
      'UI/UX',
      'Database',
      'Cloud'
    ];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  private getRandomAppName(): string {
    const apps = [
      'User Management Service',
      'Notification Service',
      'Payment Gateway',
      'Analytics Service',
      'Content Management',
      'Search Engine',
      'File Storage',
      'Authentication Service'
    ];
    return apps[Math.floor(Math.random() * apps.length)];
  }

  private getRandomHealthStatus(): string {
    const statuses = ['healthy', 'warning', 'error'];
    const weights = [0.7, 0.2, 0.1]; // 70% healthy, 20% warning, 10% error
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < statuses.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return statuses[i];
      }
    }
    return 'healthy';
  }

  private getRandomHealthMessage(): string {
    const messages = {
      healthy: [
        'All systems operational with excellent performance',
        'Service running smoothly with optimal response times',
        'No issues detected, all metrics within normal range',
        'System health is excellent, uptime at 99.9%'
      ],
      warning: [
        'High memory usage detected, monitoring closely',
        'Response times slightly elevated, investigating',
        'Minor performance degradation observed',
        'Increased error rate detected, monitoring situation'
      ],
      error: [
        'Service experiencing issues, investigating',
        'Critical error detected, immediate attention required',
        'Service unavailable, emergency response activated',
        'System failure detected, recovery in progress'
      ]
    };
    
    const status = this.getRandomHealthStatus();
    const statusMessages = messages[status as keyof typeof messages];
    return statusMessages[Math.floor(Math.random() * statusMessages.length)];
  }


  private mapPriorityToDomain(presentationPriority: FeedItemPriority): string {
    switch (presentationPriority) {
      case FeedItemPriority.LOW:
        return 'low';
      case FeedItemPriority.MEDIUM:
        return 'medium';
      case FeedItemPriority.HIGH:
        return 'high';
      case FeedItemPriority.URGENT:
        return 'urgent';
      default:
        return 'medium';
    }
  }
}
