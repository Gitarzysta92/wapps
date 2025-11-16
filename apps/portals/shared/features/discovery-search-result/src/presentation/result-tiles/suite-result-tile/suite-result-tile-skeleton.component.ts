import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';
import { NgForOf } from '@angular/common';

export const SUITE_RESULT_TILE_SKELETON_SELECTOR = 'suite-result-tile-skeleton';

@Component({
  selector: SUITE_RESULT_TILE_SKELETON_SELECTOR,
  templateUrl: './suite-result-tile-skeleton.component.html',
  styleUrl: './suite-result-tile-skeleton.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiSkeleton,
    NgForOf
  ]
})
export class SuiteResultTileSkeletonComponent {}

