import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';
import { ContentFeedItemBlankComponent } from '@ui/content-feed';

export const ARTICLE_RESULT_TILE_SKELETON_SELECTOR = 'article-result-tile-skeleton';

@Component({
  selector: ARTICLE_RESULT_TILE_SKELETON_SELECTOR,
  templateUrl: './article-result-tile-skeleton.component.html',
  styleUrl: './article-result-tile-skeleton.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemBlankComponent,
    TuiSkeleton
  ]
})
export class ArticleResultTileSkeletonComponent {}

