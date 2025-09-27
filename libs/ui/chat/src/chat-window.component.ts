import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  sender: 'user' | 'other';
  senderName?: string;
}

@Component({
  selector: "ui-chat-window",
  templateUrl: "chat-window.component.html",
  styleUrl: 'chat-window.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
  ],
})
export class ChatWindowComponent {
  public readonly messages = input<ChatMessage[]>([]);
  public readonly currentUser = input<string>('You');
  public readonly otherUser = input<string>('Other User');



  public formatTimestamp(timestamp: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(timestamp);
  }
}
