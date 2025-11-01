import { Component, Input } from '@angular/core';
import type { ContentFeedItemVm } from '../content-feed-item.vm';

@Component({
  selector: 'content-feed-item-blank',
  templateUrl: './content-feed-item-blank.component.html',
  styleUrl: './content-feed-item-blank.component.scss',
  standalone: true,
})
export class ContentFeedItemBlankComponent {
  @Input() item: ContentFeedItemVm | undefined;
  @Input() icon: string | undefined;
}


