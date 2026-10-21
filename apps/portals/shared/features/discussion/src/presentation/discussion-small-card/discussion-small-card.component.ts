import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon, TuiAppearance } from '@taiga-ui/core';
import { TuiBadge, TuiAvatar } from '@taiga-ui/kit';
import { MediumCardComponent } from '@ui/layout';
import { DiscussionPreviewDto } from '@domains/discussion';
import { RelativeTimePipe } from '../relative-time.pipe';

export type DiscussionSmallCardData = Omit<DiscussionPreviewDto, 'viewsCount' | 'createdAt' | 'associationId' | 'associationSlug'> & {
  viewsCount?: number;
  createdAt: Date | null;
  repliesIncludeRemoved?: boolean;
  viewsUnavailableLabel?: string;
};

@Component({
  selector: 'discussion-small-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TuiIcon,
    TuiBadge,
    TuiAvatar,
    TuiAppearance,
    MediumCardComponent,
    RelativeTimePipe,
  ],
  templateUrl: './discussion-small-card.component.html',
  styleUrls: ['./discussion-small-card.component.scss'],
})
export class DiscussionSmallCardComponent {
  public readonly data = input.required<DiscussionSmallCardData>();
  public readonly appearance = input<string>();
}
