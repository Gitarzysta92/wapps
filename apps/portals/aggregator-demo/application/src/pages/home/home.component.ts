import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TuiDropdown } from "@taiga-ui/core";
import { TuiBadgedContent } from "@taiga-ui/kit";
import { MultiSearchComponent, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from '@portals/shared/features/multi-search';
import { SearchMockDataService, ListingSearchService } from '@portals/shared/features/search';
import { NewsFeedPageComponent, FeedItemType, NewsFeedItemComponent, DiscussionComponent, NewsFeedService } from '@portals/shared/features/feed';
import { ArticleHighlightFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationHealthFeedItemComponent } from '@portals/shared/features/feed';
import { HomePageStateService } from "./home-page-state.service";


 
@Component({
  selector: 'home-page',
  templateUrl: "home.component.html",
  styleUrl: 'home.component.scss',
  imports: [
    CommonModule,
    MultiSearchComponent,
    NewsFeedPageComponent,
    NewsFeedItemComponent,
    DiscussionComponent,
    ArticleHighlightFeedItemComponent,
    ApplicationHealthFeedItemComponent,
    TuiDropdown,
    TuiBadgedContent,
  ],
  providers: [
    SearchMockDataService,
    NewsFeedService,
    { provide: MULTISEARCH_RESULTS_PROVIER, useClass: ListingSearchService },
    { provide: MULTISEARCH_STATE_PROVIDER, useClass: HomePageStateService }
  ]
})
export class HomePageComponent {
  FeedItemType = FeedItemType;
}