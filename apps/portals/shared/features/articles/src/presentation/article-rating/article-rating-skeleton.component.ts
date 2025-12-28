import { Component } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';

@Component({
  selector: 'article-rating-skeleton',
  standalone: true,
  imports: [TuiSkeleton],
  templateUrl: './article-rating-skeleton.component.html',
  styleUrl: './article-rating-skeleton.component.scss'
})
export class ArticleRatingSkeletonComponent {}


