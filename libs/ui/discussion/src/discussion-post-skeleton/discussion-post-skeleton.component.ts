import { Component, input } from '@angular/core';
import { DiscussionPostHeaderSkeletonComponent } from '../discussion-post-header-skeleton';
import { DiscussionPostContentSkeletonComponent } from '../discussion-post-content-skeleton';
import { DiscussionPostActionsSkeletonComponent } from '../discussion-post-actions-skeleton';

@Component({
  selector: 'ui-discussion-post-skeleton',
  standalone: true,
  imports: [
    DiscussionPostHeaderSkeletonComponent,
    DiscussionPostContentSkeletonComponent,
    DiscussionPostActionsSkeletonComponent
  ],
  templateUrl: './discussion-post-skeleton.component.html',
  styleUrl: './discussion-post-skeleton.component.scss'
})
export class DiscussionPostSkeletonComponent {
  contentLines = input<number>(3);
}

