import { HomeSearchProviderService } from './home-search-provider.service';
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TuiDropdown } from "@taiga-ui/core";
import { TuiBadgedContent } from "@taiga-ui/kit";
import {
  MultiSearchComponent,
  MULTISEARCH_RESULTS_PROVIER,
  MULTISEARCH_STATE_PROVIDER,
  MULTISEARCH_ACCEPTED_QUERY_PARAM
} from '@portals/shared/features/multi-search';
import { HomeSearchResultsComponent } from './home-search-results.component';
import { HomeRecentSearchesComponent } from './home-recent-searches.component';
import { SearchMockDataService } from '@portals/shared/features/search';
import {
  NewsFeedService,
  APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
  APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
  APPLICATION_TEASER_FEED_ITEM_SELECTOR,
  APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
  SUITE_TEASER_FEED_ITEM_SELECTOR,
  DISCUSSION_TOPIC_FEED_ITEM_SELECTOR,
  ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
  FEED_PROVIDER_TOKEN,
  ApplicationHealthFeedItemVM,
  ApplicationTeaserFeedItemVM,
  ApplicationReviewFeedItemVM,
  ApplicationDevLogFeedItemVM,
  SuiteTeaserFeedItemVM,
  DiscussionTopicFeedItemVM,
  ArticleHighlightFeedItemVM
} from '@portals/shared/features/feed';
import { mapAttributionToVM } from '@portals/shared/features/attribution';
import { HomePageStateService } from "./home-page-state.service";
import { TempFeedProviderService } from "./temp-feed-provider.service";
import { ArticleHighlightFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationHealthFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationReviewFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationTeaserFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationDevLogFeedItemComponent } from '@portals/shared/features/feed';
import { SuiteTeaserFeedItemComponent } from '@portals/shared/features/feed';
import { DiscussionTopicFeedItemComponent } from '@portals/shared/features/feed';
import { FeedContainerComponent } from "@portals/shared/features/feed";
import { IntroHeroComponent } from '@ui/intro-hero';
import { DecorationFadeDirective, WobbleOutlineDirective } from '@ui/layout';
import { NAVIGATION } from "../../navigation";
import { FEED_ITEM_EXAMPLES } from '@portals/shared/data';

import { combineLatest, map, take } from "rxjs";
import { PreferencesService } from '@portals/shared/features/preferences';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { CATALOG_ENTRIES } from '@portals/shared/features/listing';
import { sortHomeFeed } from './home-feed-sort';
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import { FILTERS } from "../../filters";

type RegisteredFeedItem = Array<
  ApplicationHealthFeedItemVM & { type: typeof APPLICATION_HEALTH_FEED_ITEM_SELECTOR } |
  ApplicationTeaserFeedItemVM & { type: typeof APPLICATION_TEASER_FEED_ITEM_SELECTOR } |
  ApplicationReviewFeedItemVM & { type: typeof APPLICATION_REVIEW_FEED_ITEM_SELECTOR } |
  ApplicationDevLogFeedItemVM & { type: typeof APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR } |
  SuiteTeaserFeedItemVM & { type: typeof SUITE_TEASER_FEED_ITEM_SELECTOR } |
  DiscussionTopicFeedItemVM & { type: typeof DISCUSSION_TOPIC_FEED_ITEM_SELECTOR } |
  ArticleHighlightFeedItemVM & { type: typeof ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR }
>


@Component({
  selector: 'home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "home.component.html",
  styleUrl: 'home.component.scss',
  imports: [
    CommonModule,
    MultiSearchComponent,
    HomeSearchResultsComponent,
    HomeRecentSearchesComponent,
    ArticleHighlightFeedItemComponent,
    ApplicationHealthFeedItemComponent,
    ApplicationReviewFeedItemComponent,
    ApplicationTeaserFeedItemComponent,
    ApplicationDevLogFeedItemComponent,
    SuiteTeaserFeedItemComponent,
    DiscussionTopicFeedItemComponent,
    IntroHeroComponent,
    TuiDropdown,
    TuiBadgedContent,
    FeedContainerComponent,
    WobbleOutlineDirective,
    DecorationFadeDirective,
  ],
  providers: [
    SearchMockDataService,
    NewsFeedService,
    TempFeedProviderService,
    { provide: MULTISEARCH_STATE_PROVIDER, useClass: HomePageStateService },
    { provide: MULTISEARCH_ACCEPTED_QUERY_PARAM, useValue: FILTERS.search },
    {
      provide: FEED_PROVIDER_TOKEN, useFactory: () => {
        const preferences = inject(PreferencesService);
        const favorites = inject(MyFavoritesService);
        return {
      getFeedPage: () => combineLatest([preferences.preferences$, favorites.myFavorites$]).pipe(
        take(1),
        map(([savedPreferences, savedFavorites]) => ({
        ok: true,
        value: {
          items: sortHomeFeed((structuredClone(FEED_ITEM_EXAMPLES) as RegisteredFeedItem).map(i => {
            switch (i.type) {
              case APPLICATION_HEALTH_FEED_ITEM_SELECTOR:
                i.appLink = buildRoutePath(NAVIGATION.applicationHealth.path, { appSlug: i.appSlug });
                break;
              case APPLICATION_TEASER_FEED_ITEM_SELECTOR:
                i.appLink = buildRoutePath(NAVIGATION.application.path, { appSlug: i.appSlug });
                i.category.link = buildRoutePath(NAVIGATION.categories.path, { categorySlug: i.category.slug });
                i.tags.forEach((t: { slug: string; link?: string }) => {
                  t.link = buildRoutePath(NAVIGATION.tags.path, { tagSlug: t.slug });
                });
                i.reviewsLink = buildRoutePath(NAVIGATION.applicationReviews.path, { appSlug: i.appSlug });
                break;
              case APPLICATION_REVIEW_FEED_ITEM_SELECTOR:
                i.appLink = buildRoutePath(NAVIGATION.applicationReviews.path, { appSlug: i.appSlug });
                break;
              case APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR:
                i.appLink = buildRoutePath(NAVIGATION.applicationDevLog.path, { appSlug: i.appSlug });
                if (i.attribution) {
                  i.attribution = mapAttributionToVM(i.attribution) as any;
                }
                break;
              case SUITE_TEASER_FEED_ITEM_SELECTOR:
                i.suiteLink = buildRoutePath(NAVIGATION.suite.path, { suiteSlug: i.suiteTitle.toLowerCase().replace(/\s+/g, '-') });
                break;
              case DISCUSSION_TOPIC_FEED_ITEM_SELECTOR:
                i.topicLink = buildRoutePath(NAVIGATION.applicationDiscussion.path, { appSlug: i.appSlug, discussionSlug: i.discussionSlug });
                break;
              case ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR: {
                // Extract slug from title or use a default pattern
                const articleSlug = (i.title || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                i.articleLink = buildRoutePath(NAVIGATION.article.path, { articleSlug });
                break;
              }
              default:
                //throw new Error(`Unknown feed item type: ${i.type}`);
            }
            return i;
          }), savedPreferences.data.content.feedSortOrder, savedFavorites.data, CATALOG_ENTRIES),
          hasMore: false,
          nextPage: undefined
        }
      })))
        };
      }
    },
    { provide: MULTISEARCH_RESULTS_PROVIER, useClass: HomeSearchProviderService }
  ]
})
export class HomePageComponent {
  feedItemType = {
    APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
    ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
    APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
    APPLICATION_TEASER_FEED_ITEM_SELECTOR,
    APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
    SUITE_TEASER_FEED_ITEM_SELECTOR,
    DISCUSSION_TOPIC_FEED_ITEM_SELECTOR
  };

  navigation = {
    overview: NAVIGATION.applicationOverview,
    reviews: NAVIGATION.applicationReviews,
    health: NAVIGATION.applicationHealth,
    devlog: NAVIGATION.applicationDevLog,
    topic: NAVIGATION.applicationDiscussion
  }
}
