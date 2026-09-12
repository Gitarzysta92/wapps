import { Component, inject, input, effect } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';
import { APPLICATION_HEALTH_FEED_ITEM_SELECTOR, APPLICATION_REVIEW_FEED_ITEM_SELECTOR, APPLICATION_TEASER_FEED_ITEM_SELECTOR, APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR, SUITE_TEASER_FEED_ITEM_SELECTOR, DISCUSSION_TOPIC_FEED_ITEM_SELECTOR, ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR, NewsFeedService, FEED_PROVIDER_TOKEN } from '@portals/shared/features/feed';
import { ArticleHighlightFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationHealthFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationReviewFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationTeaserFeedItemComponent } from '@portals/shared/features/feed';
import { ApplicationDevLogFeedItemComponent } from '@portals/shared/features/feed';
import { SuiteTeaserFeedItemComponent } from '@portals/shared/features/feed';
import { DiscussionTopicFeedItemComponent } from '@portals/shared/features/feed';
import { FeedContainerComponent } from "@portals/shared/features/feed";
import { ApplicationTimelineFeedProviderService } from './application-timeline-feed-provider.service';
import { APPLICATIONS } from '@portals/shared/data';

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
    { provide: FEED_PROVIDER_TOKEN, useExisting: ApplicationTimelineFeedProviderService },
  ]
})
export class ApplicationTimelinePageComponent {
  readonly appSlug = input<string | null>(null);
  readonly provider = inject(ApplicationTimelineFeedProviderService);
  readonly feed = inject(NewsFeedService);
  app() { return APPLICATIONS.find(app => app.slug === this.appSlug()); }
  constructor() {
    effect(() => {
      this.provider.setApplication(this.appSlug() ?? '');
      this.feed.refresh();
    });
  }

  feedItemType = {
    APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
    ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
    APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
    APPLICATION_TEASER_FEED_ITEM_SELECTOR,
    APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
    SUITE_TEASER_FEED_ITEM_SELECTOR,
    DISCUSSION_TOPIC_FEED_ITEM_SELECTOR
  };

}
