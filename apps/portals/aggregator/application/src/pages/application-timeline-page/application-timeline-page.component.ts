import { RouterLink } from '@angular/router';
import { Component, inject, input, effect, computed } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TuiIcon, TuiButton } from '@taiga-ui/core';
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
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { PageHeaderComponent, PageTitleComponent, ContentStateComponent } from '@ui/layout';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { NAVIGATION_NAME_PARAMS } from '../../navigation';
import { APPLICATIONS } from '@portals/shared/data';

@Component({
  selector: 'app-application-timeline-page',
  standalone: true,
  imports: [
    RouterLink,
    TuiButton,
    ContentStateComponent,
    AsyncPipe,
    BreadcrumbsComponent,
    PageHeaderComponent,
    PageTitleComponent,
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
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly breadcrumbData = computed(() => this.breadcrumb().map(item => ({
    ...item,
    path: '/' + item.path.replace(/^\/+/, '').replace(':appSlug', encodeURIComponent(this.appSlug() ?? '')),
    label: item.label.replace(NAVIGATION_NAME_PARAMS.applicationName, this.app()?.name ?? 'Unknown Application'),
  })));
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
