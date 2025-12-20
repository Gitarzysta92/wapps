import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-discussion-post-content-skeleton',
  standalone: true,
  imports: [],
  templateUrl: './discussion-post-content-skeleton.component.html',
  styleUrl: './discussion-post-content-skeleton.component.scss'
})
export class DiscussionPostContentSkeletonComponent {
  lines = input<number>(3);
}

