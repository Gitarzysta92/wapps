import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';


export interface DiscussionPostVM {
  id: string;
  content: string;
  author: {
    name: string;
    avatar: {
      url: string;
    };
  };
  publishedTime: Date;
  engagement: {
    likes: number;
  }
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
