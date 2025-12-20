import { Component, Input, computed, signal } from "@angular/core";
import { TuiIcon } from "@taiga-ui/core";
import { TuiAvatar, TuiChip } from "@taiga-ui/kit";
import { DiscussionPostComponent } from "@ui/discussion";
import { DatePipe } from "@angular/common";

export interface TopCommentVM {
  content: string;
  authorName: string;
  authorBadges: Array<{ name: string; icon: string; appearance: string }>;
  authorAvatarUrl: string;
  date: Date | string;
  upvotes: number;
  discussionLink: string;
}

@Component({
  selector: 'top-comment',
  templateUrl: './top-comment.component.html',
  styleUrl: './top-comment.component.scss',
  standalone: true,
  imports: []
})
export class TopCommentComponent {
  private _comment = signal<TopCommentVM | null>(null);

  @Input() set comment(value: TopCommentVM) {
    this._comment.set(value);
  }

  get comment(): TopCommentVM | null {
    return this._comment();
  }

  protected engagement = computed<any>(() => {
    const comment = this._comment();
    return {
      likes: comment?.upvotes ?? 0,
      dislikes: 0,
      replies: 0,
      isLiked: false
    };
  });

  protected publishedTime = computed(() => {
    const comment = this._comment();
    if (!comment?.date) return '';
    
    const date = comment.date instanceof Date ? comment.date : new Date(comment.date);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  });
}

