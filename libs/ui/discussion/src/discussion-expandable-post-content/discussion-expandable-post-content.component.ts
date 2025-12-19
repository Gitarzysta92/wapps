import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';

@Component({
  selector: 'ui-discussion-expandable-post-content',
  standalone: true,
  imports: [],
  templateUrl: './discussion-expandable-post-content.component.html',
  styleUrls: ['./discussion-expandable-post-content.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscussionExpandablePostContentComponent {
  public readonly content = input<string>('');
  public readonly maxCharacters = input<number>(300);
  public readonly expanded = input<boolean>(false);
}
