import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';

@Component({
  selector: 'ui-discussion-post-header',
  standalone: true,
  imports: [],
  templateUrl: './discussion-post-header.component.html',
  styleUrls: ['./discussion-post-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscussionPostHeaderComponent {
  public readonly authorName = input<string>('');
  public readonly authorAvatarUrl = input<string>('');
  public readonly publishedTime = input<Date | string>(new Date());
}
