import { Component, Input } from '@angular/core';
import type { ContentFeedItemVm } from './content-feed-item.vm';
import { TuiIcon, TuiIconPipe } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';

@Component({
  selector: 'content-feed-item',
  templateUrl: './content-feed-item.component.html',
  styleUrl: './content-feed-item.component.scss',
  standalone: true,
  imports: [
    TuiIcon,
    TuiAvatar,
    TuiIconPipe
  ]
})
export class ContentFeedItemComponent {
  @Input() item: ContentFeedItemVm | undefined;
  @Input() icon: string | undefined;
}
