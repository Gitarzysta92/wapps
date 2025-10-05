import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IFeedItem, FeedItemType } from './models';
import { ArticleHighlightFeedItemComponent } from './feed-items/article-highlight-feed-item.component';
import { ApplicationHealthFeedItemComponent } from './feed-items/application-health-feed-item.component';

@Component({
  selector: 'news-feed',
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ArticleHighlightFeedItemComponent,
    ApplicationHealthFeedItemComponent
  ]
})
export class NewsFeedPageComponent {
  @Input() feedItems: IFeedItem[] = [];

  FeedItemType = FeedItemType;

  constructor() {}
}
