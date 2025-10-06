import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { IFeedItem, IFeedItemComponent } from '../../../feed/src/presentation/models';

@Component({
  selector: 'article-highlight-feed-item',
  templateUrl: './article-highlight-feed-item.component.html',
  styleUrl: './article-highlight-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class ArticleHighlightFeedItemComponent implements IFeedItemComponent {
  @Input() item!: IFeedItem;
}
