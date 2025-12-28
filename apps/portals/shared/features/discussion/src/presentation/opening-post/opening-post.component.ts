import { Component, Input, Output, EventEmitter, computed, signal } from "@angular/core";
import { TuiIcon } from "@taiga-ui/core";
import { TuiAvatar, TuiChip } from "@taiga-ui/kit";
import { DiscussionPostComponent } from "@ui/discussion";
import { DatePipe } from "@angular/common";

export interface OpeningPostVM {
  id: string;
  title?: string;
  content: string;
  authorName: string;
  authorId: string;
  authorBadges: Array<{ name: string; icon: string; appearance: string }>;
  authorAvatarUrl: string;
  date: Date | string;
  engagement: {
    upvotes: number;
    downvotes?: number;
    replies: number;
    views?: number;
    isUpvoted?: boolean;
    isDownvoted?: boolean;
  };
  tags?: Array<{ id: string; name: string; color?: string }>;
  isPinned?: boolean;
  isLocked?: boolean;
  isEdited?: boolean;
  editedAt?: Date | string;
}

@Component({
  selector: 'opening-post',
  templateUrl: './opening-post.component.html',
  styleUrl: './opening-post.component.scss',
  standalone: true,
  imports: [
    TuiIcon,
    TuiChip
  ]
})
export class OpeningPostComponent {
  @Output() upvote = new EventEmitter<string>();
  @Output() downvote = new EventEmitter<string>();
  @Output() reply = new EventEmitter<string>();
  @Output() share = new EventEmitter<string>();
  @Output() edit = new EventEmitter<string>();
  @Output() tagClick = new EventEmitter<string>();

  private _post = signal<OpeningPostVM | null>(null);

  @Input() set post(value: OpeningPostVM) {
    this._post.set(value);
  }

  get post(): OpeningPostVM | null {
    return this._post();
  }

  @Input() canEdit = false;
  @Input() canReply = true;
  @Input() showTitle = true;
  @Input() showTags = true;
  @Input() maxCharacterAmount = 500;

  protected engagement = computed<any>(() => {
    const post = this._post();
    if (!post) {
      return { likes: 0, dislikes: 0, replies: 0 };
    }

    return {
      likes: post.engagement.upvotes,
      dislikes: post.engagement.downvotes || 0,
      replies: post.engagement.replies,
      isLiked: post.engagement.isUpvoted || false,
      isDisliked: post.engagement.isDownvoted || false
    };
  });

  protected publishedTime = computed(() => {
    const post = this._post();
    if (!post?.date) return '';
    
    const date = post.date instanceof Date ? post.date : new Date(post.date);
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

  protected editedTime = computed(() => {
    const post = this._post();
    if (!post?.isEdited || !post?.editedAt) return '';
    
    const date = post.editedAt instanceof Date ? post.editedAt : new Date(post.editedAt);
    return date.toLocaleDateString();
  });

  protected onUpvote(): void {
    const post = this._post();
    if (post) {
      this.upvote.emit(post.id);
    }
  }

  protected onDownvote(): void {
    const post = this._post();
    if (post) {
      this.downvote.emit(post.id);
    }
  }

  protected onReply(): void {
    const post = this._post();
    if (post) {
      this.reply.emit(post.id);
    }
  }

  protected onShare(): void {
    const post = this._post();
    if (post) {
      this.share.emit(post.id);
    }
  }

  protected onEdit(): void {
    const post = this._post();
    if (post) {
      this.edit.emit(post.id);
    }
  }

  protected onTagClick(tagId: string): void {
    this.tagClick.emit(tagId);
  }
}

