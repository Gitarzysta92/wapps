import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'ui-discussion-voting-button',
  standalone: true,
  imports: [TuiButton, TuiIcon],
  templateUrl: './discussion-voting-button.component.html',
  styleUrls: ['./discussion-voting-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscussionVotingButtonComponent {
  public readonly upvotes = input<number>(0);
  public readonly downvotes = input<number>(0);
  public readonly isUpvoted = input<boolean>(false);
  public readonly isDownvoted = input<boolean>(false);
  
  public readonly upvote = output<void>();
  public readonly downvote = output<void>();

  protected onUpvote(): void {
    this.upvote.emit();
  }

  protected onDownvote(): void {
    this.downvote.emit();
  }
}
