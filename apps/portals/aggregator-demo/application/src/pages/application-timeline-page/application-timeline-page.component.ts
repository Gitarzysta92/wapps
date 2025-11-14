import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { map, of, shareReplay } from 'rxjs';
import { TuiIcon } from '@taiga-ui/core';
import { APPLICATION_HEALTH_FEED_ITEM_SELECTOR, APPLICATION_REVIEW_FEED_ITEM_SELECTOR, APPLICATION_TEASER_FEED_ITEM_SELECTOR, APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR, SUITE_TEASER_FEED_ITEM_SELECTOR, DISCUSSION_TOPIC_FEED_ITEM_SELECTOR, ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR, NewsFeedService, FEED_PROVIDER_TOKEN, ApplicationTeaserFeedItemVM, ApplicationDevLogFeedItemVM, ApplicationHealthFeedItemVM, ApplicationReviewFeedItemVM, ArticleHighlightFeedItemVM, DiscussionTopicFeedItemVM, SuiteTeaserFeedItemVM } from '@portals/shared/features/feed';
import { ArticleHighlightFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationHealthFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationReviewFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationTeaserFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationDevLogFeedItemComponent } from '@portals/shared/features/feed';
import { SuiteTeaserFeedItemComponent } from '@portals/shared/features/feed';
import { DiscussionTopicFeedItemComponent } from '@portals/shared/features/feed';
import { FeedContainerComponent } from "@portals/shared/features/feed";
import { AppRecordDto } from '@domains/catalog/record';
import { ApplicationTimelineFeedProviderService } from './application-timeline-feed-provider.service';
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import { FEED_ITEM_EXAMPLES } from '@portals/shared/data';
import { NAVIGATION } from '../../navigation';

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
  selector: 'app-application-timeline-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ArticleHighlightFeedItemComponent,
    ApplicationHealthFeedItemComponent,
    ApplicationReviewFeedItemComponent,
    ApplicationTeaserFeedItemComponent,
    ApplicationDevLogFeedItemComponent,
    SuiteTeaserFeedItemComponent,
    DiscussionTopicFeedItemComponent,
    TuiIcon,
    FeedContainerComponent
  ],
  templateUrl: './application-timeline-page.component.html',
  styleUrl: './application-timeline-page.component.scss',
  providers: [
    NewsFeedService,
    ApplicationTimelineFeedProviderService,
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
          }
        },
  ]
})
export class ApplicationTimelinePageComponent {
  private readonly _route = inject(ActivatedRoute);

  public readonly app$ = this._route.paramMap.pipe(
    map(p => p.get('appSlug') ?? 'unknown'),
    map(slug => this._buildMockFromSlug(slug)),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  feedItemType = {
    APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
    ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
    APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
    APPLICATION_TEASER_FEED_ITEM_SELECTOR,
    APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
    SUITE_TEASER_FEED_ITEM_SELECTOR,
    DISCUSSION_TOPIC_FEED_ITEM_SELECTOR
  };

  private _buildMockFromSlug(slug: string): AppRecordDto {
    const name = slug
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    return {
      id: slug,
      slug,
      name,
      description: `${name} description`,
      logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
      isPwa: true,
      rating: 4.7,
      tagIds: [],
      categoryId: 0,
      platformIds: [],
      reviewNumber: 1234,
      updateDate: new Date(),
      listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    };
  }
}
