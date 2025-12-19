import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'ui-discussion-reply-button',
  standalone: true,
  imports: [TuiButton, TuiIcon],
  templateUrl: './discussion-reply-button.component.html',
  styleUrls: ['./discussion-reply-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscussionReplyButtonComponent {
  public readonly replyCount = input<number>(0);
  public readonly label = input<string>('Reply');
  
  public readonly reply = output<void>();

  protected onReply(): void {
    this.reply.emit();
  }
}
