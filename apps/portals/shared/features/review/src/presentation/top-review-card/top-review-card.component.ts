import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiAvatar } from '@taiga-ui/kit';

export interface TopReview {
  authorName: string;
  authorAvatarUrl: string;
  authorBadges?: any[];
  rating: number;
  content: string;
  date: string;
}

@Component({
  selector: 'top-review-card',
  standalone: true,
  imports: [CommonModule, TuiAvatar],
  templateUrl: './top-review-card.component.html',
  styleUrl: './top-review-card.component.scss'
})
export class TopReviewCardComponent {
  review = input.required<TopReview>();
}


