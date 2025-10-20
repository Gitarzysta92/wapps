import { Component } from "@angular/core";
import { CommonModule, NgIf } from "@angular/common";
import { TuiDropdown } from "@taiga-ui/core";
import { TuiBadgedContent } from "@taiga-ui/kit";
import { MultiSearchComponent, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from '@portals/shared/features/multi-search';
import { SearchMockDataService, ListingSearchService } from '@portals/shared/features/search';
import { APPLICATION_HEALTH_FEED_ITEM_SELECTOR, APPLICATION_REVIEW_FEED_ITEM_SELECTOR, ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR, NewsFeedService } from '@portals/shared/features/feed';
import { HomePageStateService } from "./home-page-state.service";
import { ContentFeedComponent, ContentFeedItemComponent } from '@ui/content-feed'
import { ArticleHighlightFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationHealthFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationReviewFeedItemComponent } from '@portals/shared/features/feed';
import { FeedContainerComponent } from "@portals/shared/features/feed";
import { DiscussionComponent } from '@portals/shared/features/discussion'

@Component({
  selector: 'home-page',
  templateUrl: "home.component.html",
  styleUrl: 'home.component.scss',
  imports: [
    CommonModule,
    MultiSearchComponent,
    ContentFeedComponent,
    ContentFeedItemComponent,
    ArticleHighlightFeedItemComponent,
    ApplicationHealthFeedItemComponent,
    ApplicationReviewFeedItemComponent,
    TuiDropdown,
    TuiBadgedContent,
    FeedContainerComponent,
    NgIf,
    DiscussionComponent
  ],
  providers: [
    SearchMockDataService,
    NewsFeedService,
    { provide: MULTISEARCH_RESULTS_PROVIER, useClass: ListingSearchService },
    { provide: MULTISEARCH_STATE_PROVIDER, useClass: HomePageStateService }
  ]
})
export class HomePageComponent {
  feedItemType = {
    APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
    ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
    APPLICATION_REVIEW_FEED_ITEM_SELECTOR
  };
}