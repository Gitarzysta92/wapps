import { Component } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';

@Component({
  selector: 'article-author-info-skeleton',
  standalone: true,
  imports: [TuiSkeleton],
  templateUrl: './article-author-info-skeleton.component.html',
  styleUrl: './article-author-info-skeleton.component.scss'
})
export class ArticleAuthorInfoSkeletonComponent {}


