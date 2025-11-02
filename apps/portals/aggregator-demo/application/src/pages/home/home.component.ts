import { Component } from "@angular/core";
import { CommonModule, NgIf } from "@angular/common";
import { TuiDropdown } from "@taiga-ui/core";
import { TuiBadgedContent } from "@taiga-ui/kit";
import { MultiSearchComponent, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from '@portals/shared/features/multi-search';
import { SearchMockDataService, ListingSearchService } from '@portals/shared/features/search';
import { APPLICATION_HEALTH_FEED_ITEM_SELECTOR, APPLICATION_REVIEW_FEED_ITEM_SELECTOR, APPLICATION_TEASER_FEED_ITEM_SELECTOR, APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR, SUITE_TEASER_FEED_ITEM_SELECTOR, DISCUSSION_TOPIC_FEED_ITEM_SELECTOR, ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR, NewsFeedService, FEED_PROVIDER_TOKEN, ApplicationHealthFeedItemVM, ApplicationTeaserFeedItemVM, ApplicationReviewFeedItemVM, ApplicationDevLogFeedItemVM, SuiteTeaserFeedItemVM, DiscussionTopicFeedItemVM, ArticleHighlightFeedItemVM } from '@portals/shared/features/feed';
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
import { DiscussionComponent } from '@portals/shared/features/discussion';
import { IntroHeroComponent } from '@ui/intro-hero';
import { NAVIGATION } from "../../navigation";
import { FEED_ITEM_EXAMPLES } from '@portals/shared/data';
import { of } from "rxjs";
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import { provideTypedClass } from "@ui/misc";
import { MultiSearchService } from "@portals/shared/features/multi-search";

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
  templateUrl: "home.component.html",
  styleUrl: 'home.component.scss',
  imports: [
    CommonModule,
    MultiSearchComponent,
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
    NgIf,
    DiscussionComponent
  ],
  providers: [
    SearchMockDataService,
    NewsFeedService,
    TempFeedProviderService,
    provideTypedClass(MULTISEARCH_RESULTS_PROVIER, MultiSearchService),
    { provide: MULTISEARCH_STATE_PROVIDER, useClass: HomePageStateService },
    {
      provide: FEED_PROVIDER_TOKEN, useValue: {
      getFeedPage: () => of({
        ok: true,
        value: {
          items: (FEED_ITEM_EXAMPLES as RegisteredFeedItem).map(i => {
    
            switch (i.type) {
              case APPLICATION_HEALTH_FEED_ITEM_SELECTOR:
                i.appLink = buildRoutePath(NAVIGATION.applicationHealth.path, { appSlug: i.appSlug });
                break;
              case APPLICATION_TEASER_FEED_ITEM_SELECTOR:
                i.appLink = buildRoutePath(NAVIGATION.application.path, { appSlug: i.appSlug });
                i.category.link = buildRoutePath(NAVIGATION.categories.path, { categorySlug: i.category.slug });
                i.tags.forEach(t => {
                  t.link = buildRoutePath(NAVIGATION.tags.path, { tagSlug: t.slug });
                });
                i.reviewsLink = buildRoutePath(NAVIGATION.applicationReviews.path, { appSlug: i.appSlug });
                break;
              case APPLICATION_REVIEW_FEED_ITEM_SELECTOR:
                i.appLink = buildRoutePath(NAVIGATION.applicationReviews.path, { appSlug: i.appSlug });
                break;
              case APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR:
                i.appLink = buildRoutePath(NAVIGATION.applicationDevLog.path, { appSlug: i.appSlug });
                break;
              case SUITE_TEASER_FEED_ITEM_SELECTOR:
                i.suiteLink = buildRoutePath(NAVIGATION.suite.path, { suiteSlug: i.suiteTitle.toLowerCase().replace(/\s+/g, '-') });
                break;
              case DISCUSSION_TOPIC_FEED_ITEM_SELECTOR:
                i.appLink = buildRoutePath(NAVIGATION.applicationTopic.path, { appSlug: i.appSlug, topicSlug: i.topicSlug });
                i.topicLink = buildRoutePath(NAVIGATION.applicationTopic.path, { appSlug: i.appSlug, topicSlug: i.topicSlug });
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
          }),
          hasMore: true,
          nextPage: 1
        }
      })
    }}
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
    topic: NAVIGATION.applicationTopic
  }
}