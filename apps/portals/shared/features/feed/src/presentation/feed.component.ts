import { ChangeDetectionStrategy, Component, Input, OnInit, OnDestroy, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { TuiLoader } from '@taiga-ui/core';
import { IFeedItem, FeedItemType } from './models';
import { ArticleHighlightFeedItemComponent } from './feed-items/article-highlight-feed-item.component';
import { ApplicationHealthFeedItemComponent } from './feed-items/application-health-feed-item.component';
import { NewsFeedService } from './services/news-feed.service';
import { InfiniteScrollDirective } from '@ui/infinite-scroll';

@Component({
  selector: 'news-feed',
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TuiLoader,
    ArticleHighlightFeedItemComponent,
    ApplicationHealthFeedItemComponent,
    InfiniteScrollDirective
  ]
})
export class NewsFeedPageComponent implements OnInit, OnDestroy {
  @Input() useInfiniteScroll = false; // Toggle between static and infinite scroll mode
  @Input() feedItems: IFeedItem[] = []; // For static mode
  @Input() itemTemplate?: TemplateRef<{ $implicit: IFeedItem }>; // Custom template for rendering items

  FeedItemType = FeedItemType;
  
  // For infinite scroll mode
  public feedItems$ = this.newsFeedService.feedItems$;
  public loading$ = this.newsFeedService.loading$;
  public hasMore$ = this.newsFeedService.hasMore$;
  
  private destroy$ = new Subject<void>();

  constructor(private newsFeedService: NewsFeedService) {}

  ngOnInit(): void {
    if (this.useInfiniteScroll) {
      // Subscribe to service observables for infinite scroll mode
      this.feedItems$
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onScrolledToBottom(): void {
    if (this.useInfiniteScroll) {
      this.newsFeedService.loadNextPage();
    }
  }

  refresh(): void {
    if (this.useInfiniteScroll) {
      this.newsFeedService.refresh();
    }
  }

  get currentFeedItems(): IFeedItem[] {
    return this.useInfiniteScroll ? [] : this.feedItems;
  }
}
