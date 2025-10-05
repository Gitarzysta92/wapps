import { Component } from "@angular/core";
import { TuiDropdown } from "@taiga-ui/core";
import { TuiBadgedContent } from "@taiga-ui/kit";
import { MultiSearchComponent, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from '@portals/shared/features/multi-search';
import { SearchMockDataService, ListingSearchService } from '@portals/shared/features/search';
import { NewsFeedPageComponent, IFeedItem, FeedItemType, FeedItemPriority } from '@portals/shared/features/feed';
import { HomePageStateService } from "./home-page-state.service";


 
@Component({
  selector: 'home-page',
  templateUrl: "home.component.html",
  styleUrl: 'home.component.scss',
  imports: [
    MultiSearchComponent,
    NewsFeedPageComponent,
    TuiDropdown,
    TuiBadgedContent,
  ],
  providers: [
    SearchMockDataService,
    { provide: MULTISEARCH_RESULTS_PROVIER, useClass: ListingSearchService },
    { provide: MULTISEARCH_STATE_PROVIDER, useClass: HomePageStateService }
  ]
})
export class HomePageComponent {
  // Example feed items - in real app, these would come from various services
  feedItems: IFeedItem[] = [
    {
      id: '1',
      type: FeedItemType.ARTICLE_HIGHLIGHT,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      priority: FeedItemPriority.HIGH,
      metadata: {
        title: 'New Angular 18 Features Released',
        excerpt: 'Discover the latest features in Angular 18 including improved performance and new developer tools.',
        author: 'Angular Team',
        category: 'Technology'
      }
    },
    {
      id: '2',
      type: FeedItemType.APPLICATION_HEALTH,
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      priority: FeedItemPriority.MEDIUM,
      metadata: {
        appName: 'User Management Service',
        status: 'healthy',
        message: 'All systems operational with 99.9% uptime',
        responseTime: 45
      }
    },
    {
      id: '3',
      type: FeedItemType.ARTICLE_HIGHLIGHT,
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      priority: FeedItemPriority.MEDIUM,
      metadata: {
        title: 'Best Practices for Microservices Architecture',
        excerpt: 'Learn how to design and implement scalable microservices with proper communication patterns.',
        author: 'DevOps Team',
        category: 'Architecture'
      }
    },
    {
      id: '4',
      type: FeedItemType.APPLICATION_HEALTH,
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      priority: FeedItemPriority.LOW,
      metadata: {
        appName: 'Notification Service',
        status: 'warning',
        message: 'High memory usage detected, monitoring closely',
        responseTime: 120
      }
    }
  ];
}