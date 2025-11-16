import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';

export interface TopReviewVM {
  rate: number;
  content: string;
  authorName: string;
  authorAvatarUrl: string;
}

@Component({
  selector: 'top-review',
  templateUrl: './top-review.component.html',
  styleUrl: './top-review.component.scss',
  standalone: true,
  imports: [
    TuiAvatar,
    TuiChip,
    TuiIcon,
    DecimalPipe
  ]
})
export class TopReviewComponent {
  @Input() review!: TopReviewVM;
}


