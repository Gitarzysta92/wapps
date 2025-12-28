import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiSkeleton } from '@taiga-ui/kit';
import { MediumCardSkeletonComponent } from '@ui/layout';

@Component({
  selector: 'discussion-medium-card-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TuiSkeleton,
    MediumCardSkeletonComponent,
  ],
  templateUrl: './discussion-medium-card-skeleton.component.html',
  styleUrls: ['./discussion-medium-card-skeleton.component.scss'],
})
export class DiscussionMediumCardSkeletonComponent {
  public readonly appearance = input<string>();
}

