import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';
import { ContentFeedItemBlankComponent } from '@ui/content-feed';

export const APPLICATION_RESULT_TILE_SKELETON_SELECTOR = 'application-result-tile-skeleton';

@Component({
  selector: APPLICATION_RESULT_TILE_SKELETON_SELECTOR,
  templateUrl: './application-result-tile-skeleton.component.html',
  styleUrl: './application-result-tile-skeleton.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemBlankComponent,
    TuiSkeleton
  ]
})
export class ApplicationResultTileSkeletonComponent {}

