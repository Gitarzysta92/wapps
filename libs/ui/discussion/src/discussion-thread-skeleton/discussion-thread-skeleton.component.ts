import { Component, input } from '@angular/core';
import { DiscussionPostSkeletonComponent } from '../discussion-post-skeleton';

@Component({
  selector: 'ui-discussion-thread-skeleton',
  standalone: true,
  imports: [DiscussionPostSkeletonComponent],
  templateUrl: './discussion-thread-skeleton.component.html',
  styleUrl: './discussion-thread-skeleton.component.scss'
})
export class DiscussionThreadSkeletonComponent {
  repliesCount = input<number>(2);
}

