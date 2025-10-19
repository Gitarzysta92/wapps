import { Component, Input } from '@angular/core';
import type { ContentFeedItemVm } from './content-feed-item.vm';
import { TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'content-feed-item',
  templateUrl: './content-feed-item.component.html',
  styleUrl: './content-feed-item.component.scss',
  standalone: true,
  imports: [TuiIcon]
})
export class ContentFeedItemComponent {
  @Input() item: ContentFeedItemVm | undefined;
  @Input() icon: string | undefined;
}
