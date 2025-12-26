import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon, TuiAppearance } from '@taiga-ui/core';
import { TuiBadge, TuiAvatar } from '@taiga-ui/kit';
import { MediumCardComponent } from '@ui/layout';
import { DiscussionPreviewDto } from '@domains/discussion';
import { RelativeTimePipe } from '../relative-time.pipe';

@Component({
  selector: 'discussion-medium-card',
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
  templateUrl: './discussion-medium-card.component.html',
  styleUrls: ['./discussion-medium-card.component.scss'],
})
export class DiscussionMediumCardComponent {
  public readonly data = input.required<DiscussionPreviewDto>();
  public readonly appearance = input<string>();
}

