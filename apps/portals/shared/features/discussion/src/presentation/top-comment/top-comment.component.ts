import { Component, Input } from "@angular/core";
import { TuiIcon } from "@taiga-ui/core";
import { TuiAvatar, TuiChip } from "@taiga-ui/kit";

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
  imports: [
    TuiIcon,
    TuiAvatar,
    TuiChip
  ]
})
export class TopCommentComponent {
  @Input() comment!: TopCommentVM;
}

