import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { IFeedItem } from '../models/feed-item.interface';

@Component({
  selector: 'news-feed-item',
  templateUrl: './news-feed-item.component.html',
  styleUrl: './news-feed-item.component.scss',
  standalone: true,
  imports: [CommonModule]
})
export class NewsFeedItemComponent {
  @Input() item!: IFeedItem;
}
