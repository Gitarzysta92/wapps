import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { FeedItemDto } from '@domains/feed';
import { IFeedItem, FeedItemPriority } from '../models/feed-item.interface';

import { ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR } from '../feed-items/article-highlight/article-highlight-feed-item.component';
import { APPLICATION_HEALTH_FEED_ITEM_SELECTOR } from '../feed-items/application-health/application-health-feed-item.component';
import { APPLICATION_REVIEW_FEED_ITEM_SELECTOR } from '../feed-items/application-review/application-review-feed-item.component';
import { APPLICATION_TEASER_FEED_ITEM_SELECTOR } from '../feed-items/application-teaser/application-teaser-feed-item.component';
import { APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR } from '../feed-items/application-dev-log/application-dev-log-feed-item.component';
import { SUITE_TEASER_FEED_ITEM_SELECTOR } from '../feed-items/suite-teaser/suite-teaser-feed-item.component';

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
      ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
      APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
      APPLICATION_TEASER_FEED_ITEM_SELECTOR,
      APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
      SUITE_TEASER_FEED_ITEM_SELECTOR
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
      
      case APPLICATION_REVIEW_FEED_ITEM_SELECTOR:
        return {
          rating: Math.floor(Math.random() * 2) + 3.5, // 3.5-5 stars
          reviewerName: this.getRandomReviewerName(),
          reviewerRole: this.getRandomReviewerRole(),
          reviewerAvatar: '',
          testimonial: this.getRandomTestimonial(),
          applicationName: this.getRandomAppName(),
          reviewDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          helpfulCount: Math.floor(Math.random() * 150) + 10
        };
      
      case APPLICATION_TEASER_FEED_ITEM_SELECTOR:
        return {
          applicationName: this.getRandomAppName(),
          description: this.getRandomAppDescription(),
          category: this.getRandomCategory(),
          tags: this.getRandomTags(),
          coverImage: {
            url: "https://picsum.photos/800/400",
            alt: ""
          },
          aggregatedScore: Math.floor(Math.random() * 2) + 3.5, // 3.5-5 stars
          reviewsCount: Math.floor(Math.random() * 500) + 50,
          categoryLink: `/category/${this.getRandomCategory().toLowerCase()}`,
          reviewsLink: `/reviews`
        };
      
      case APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR:
        return {
          applicationName: this.getRandomAppName(),
          version: this.getRandomVersion(),
          description: this.getRandomVersionDescription(),
          releaseDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          changes: this.getRandomChanges(),
          changeType: this.getRandomChangeType()
        };
      
      case SUITE_TEASER_FEED_ITEM_SELECTOR:
        return {
          suiteTitle: this.getRandomSuiteTitle(),
          suiteDescription: this.getRandomSuiteDescription(),
          apps: this.getRandomSuiteApps(),
          category: 'Suite'
        };
      
      default:
        return {};
    }
  }

  private getRandomSuiteTitle(): string {
    const titles = [
      'Productivity Suite',
      'Developer Tools Suite',
      'Creative Professional Suite',
      'Business Intelligence Suite',
      'Marketing Automation Suite',
      'Data Analytics Suite',
      'Enterprise Management Suite',
      'Communication & Collaboration Suite'
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  }

  private getRandomSuiteDescription(): string {
    const descriptions = [
      'A comprehensive collection of tools designed to boost your productivity.',
      'Everything you need in one integrated suite of applications.',
      'Powerful tools working together seamlessly for your business needs.',
      'Integrated applications built for modern workflows.',
      'Complete solution with all the tools your team needs.',
      'Professional-grade applications designed to work together.',
      'All-in-one suite for maximum efficiency and collaboration.',
      'Transform your workflow with this powerful suite of tools.'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private getRandomSuiteApps(): Array<{ name: string; logo?: string; description?: string }> {
    const allApps = [
      { name: 'Analytics Pro', description: 'Advanced analytics and reporting' },
      { name: 'Task Manager', description: 'Organize and track your tasks' },
      { name: 'Team Chat', description: 'Real-time team communication' },
      { name: 'File Sync', description: 'Cloud storage and file sharing' },
      { name: 'Project Board', description: 'Visual project management' },
      { name: 'Time Tracker', description: 'Track time and productivity' },
      { name: 'Calendar Pro', description: 'Schedule and meeting management' },
      { name: 'Notes Plus', description: 'Rich note-taking application' },
      { name: 'Invoice Manager', description: 'Create and manage invoices' },
      { name: 'CRM Suite', description: 'Customer relationship management' },
      { name: 'Email Client', description: 'Professional email solution' },
      { name: 'Video Conference', description: 'HD video meetings' }
    ];
    
    const count = Math.floor(Math.random() * 3) + 4; // 4-6 apps
    const shuffled = [...allApps].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private getRandomVersion(): string {
    const major = Math.floor(Math.random() * 5) + 1;
    const minor = Math.floor(Math.random() * 10);
    const patch = Math.floor(Math.random() * 20);
    return `${major}.${minor}.${patch}`;
  }

  private getRandomVersionDescription(): string {
    const descriptions = [
      'This release includes performance improvements and bug fixes.',
      'Major update with new features and enhanced stability.',
      'Security patches and minor improvements included in this update.',
      'Significant enhancements to user experience and reliability.',
      'Critical bug fixes and performance optimizations.',
      'New features and improvements based on user feedback.',
      'Enhanced security measures and system stability improvements.',
      'Performance boost and bug fixes for a smoother experience.'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private getRandomChanges(): string[] {
    const allChanges = [
      'Added dark mode support for better usability',
      'Improved performance by 40% on large datasets',
      'Fixed critical security vulnerability in authentication',
      'Enhanced mobile responsiveness across all devices',
      'Added export functionality for reports',
      'Improved search algorithm for faster results',
      'Fixed memory leak in data processing module',
      'Added support for multiple languages',
      'Implemented real-time notifications',
      'Enhanced API rate limiting',
      'Fixed timezone handling issues',
      'Added keyboard shortcuts for power users',
      'Improved error messages and logging',
      'Added bulk operations support',
      'Fixed compatibility issues with older browsers'
    ];
    const count = Math.floor(Math.random() * 3) + 3; // 3-5 changes
    const shuffled = [...allChanges].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private getRandomChangeType(): 'major' | 'minor' | 'patch' {
    const types: ('major' | 'minor' | 'patch')[] = ['major', 'minor', 'minor', 'patch', 'patch'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private getRandomAppDescription(): string {
    const descriptions = [
      'A powerful tool for managing your projects and teams efficiently.',
      'Streamline your workflow with this innovative application solution.',
      'The ultimate platform for collaboration and productivity.',
      'Professional-grade software designed for modern businesses.',
      'Transform how you work with this cutting-edge application.',
      'Enterprise-ready solution with advanced features and integrations.',
      'Intuitive interface meets powerful functionality in this app.',
      'Built for scale, designed for simplicity and ease of use.'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private getRandomTags(): string[] {
    const allTags = [
      'Cloud', 'SaaS', 'Enterprise', 'Open Source', 'AI-Powered',
      'Real-time', 'Analytics', 'Automation', 'Integration', 'Mobile',
      'Collaboration', 'Productivity', 'Security', 'API', 'Dashboard'
    ];
    const count = Math.floor(Math.random() * 3) + 2; // 2-4 tags
    const shuffled = [...allTags].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private getRandomReviewerName(): string {
    const names = [
      'John Developer',
      'Sarah Engineer',
      'Mike Tester',
      'Emily Architect',
      'David Admin',
      'Lisa Manager',
      'Tom Designer',
      'Anna Analyst'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  private getRandomReviewerRole(): string {
    const roles = [
      'Developer',
      'Software Engineer',
      'QA Tester',
      'Solutions Architect',
      'System Administrator',
      'Project Manager',
      'UI/UX Designer',
      'Data Analyst'
    ];
    return roles[Math.floor(Math.random() * roles.length)];
  }

  private getRandomTestimonial(): string {
    const testimonials = [
      'This application has transformed our workflow. Highly recommended for teams looking to improve productivity.',
      'Excellent tool with intuitive interface. The features are exactly what we needed for our project.',
      'Outstanding performance and reliability. Our team has been using it for months without any issues.',
      'Great application with solid documentation. Easy to integrate into our existing infrastructure.',
      'Impressed with the support and regular updates. The development team really cares about user feedback.',
      'Best solution in its category. The features are comprehensive and well-thought-out.',
      'Game-changer for our development process. Saved us countless hours of manual work.',
      'Reliable and efficient. The application delivers exactly what it promises without bloat.'
    ];
    return testimonials[Math.floor(Math.random() * testimonials.length)];
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
