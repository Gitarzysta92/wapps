import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';


export interface DiscussionAuthorVM {
  id: string;
  slug: string;
  name: string;
  avatar: {
    url: string;
  };
}

export interface DiscussionPostVM {
  id: string;
  content: string;
  author: DiscussionAuthorVM;
  publishedTime: Date;
  upvotesCount: number;
  downvotesCount: number;
  isEdited: boolean;
  editedAt?: Date;
}

@Component({
  selector: 'ui-discussion-post',
  standalone: true,
  imports: [],
  templateUrl: './discussion-post.component.html',
  styleUrls: ['./discussion-post.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscussionPostComponent {
  public readonly post = input.required<DiscussionPostVM>();

}
