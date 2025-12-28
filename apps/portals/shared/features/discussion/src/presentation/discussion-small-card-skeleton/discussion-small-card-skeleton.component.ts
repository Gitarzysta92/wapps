import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiSkeleton } from '@taiga-ui/kit';
import { MediumCardSkeletonComponent } from '@ui/layout';

@Component({
  selector: 'discussion-small-card-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TuiSkeleton,
    MediumCardSkeletonComponent,
  ],
  templateUrl: './discussion-small-card-skeleton.component.html',
  styleUrls: ['./discussion-small-card-skeleton.component.scss'],
})
export class DiscussionSmallCardSkeletonComponent {
  public readonly appearance = input<string>();
}

