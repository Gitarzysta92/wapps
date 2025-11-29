import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';
import { ElevatedCardComponent } from '@ui/layout';

export const APPLICATION_RESULT_TILE_SKELETON_SELECTOR = 'application-result-tile-skeleton';

@Component({
  selector: APPLICATION_RESULT_TILE_SKELETON_SELECTOR,
  templateUrl: './application-result-tile-skeleton.component.html',
  styleUrl: './application-result-tile-skeleton.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElevatedCardComponent,
    TuiSkeleton
  ]
})
export class ApplicationResultTileSkeletonComponent {}

