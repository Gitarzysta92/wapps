import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon, TuiAppearance } from '@taiga-ui/core';
import { TuiBadge, TuiAvatar } from '@taiga-ui/kit';
import { MediumCardComponent } from '@ui/layout';

export interface DiscussionTopic {
  id: string;
  title: string;
  author: string;
  authorAvatar: string;
  createdAt: Date;
  repliesCount: number;
  viewsCount: number;
  isPinned: boolean;
  tags: string[];
  excerpt: string;
  slug: string;
}

@Component({
  selector: 'discussion-small-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TuiIcon,
    TuiBadge,
    TuiAvatar,
    TuiAppearance,
    MediumCardComponent,
    TuiAppearance
  ],
  templateUrl: './discussion-small-card.component.html',
  styleUrls: ['./discussion-small-card.component.scss'],
})
export class DiscussionSmallCardComponent {
  public readonly data = input.required<DiscussionTopic>();
  public readonly appearance = input<string>();
  public formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w ago`;
  }
}

