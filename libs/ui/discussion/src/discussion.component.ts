import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { NgForOf, NgIf, DatePipe } from '@angular/common';

export interface DiscussionMessage {
  author: string;
  authorAvatar?: string;
  message: string;
  timestamp: Date;
  likes?: number;
}

export interface DiscussionData {
  topic: string;
  category?: string;
  tags?: string[];
  messages: DiscussionMessage[];
  totalMessages?: number;
  isPopular?: boolean;
}

@Component({
  selector: 'ui-discussion',
  templateUrl: './discussion.component.html',
  styleUrl: './discussion.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiButton,
    TuiIcon,
    TuiAvatar,
    TuiChip,
    NgForOf,
    NgIf,
    DatePipe
  ]
})
export class DiscussionComponent {
  @Input() data!: DiscussionData;
  @Input() readonly: boolean = true;
  @Input() maxMessagesToShow: number = 3;

  getVisibleMessages(): DiscussionMessage[] {
    return this.data.messages.slice(0, this.maxMessagesToShow);
  }

  hasMoreMessages(): boolean {
    return this.data.messages.length > this.maxMessagesToShow;
  }

  getRemainingCount(): number {
    return this.data.messages.length - this.maxMessagesToShow;
  }
}

