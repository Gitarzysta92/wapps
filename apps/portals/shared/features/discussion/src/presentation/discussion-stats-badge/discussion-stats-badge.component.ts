import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TuiBadge } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'discussion-stats-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiIcon,
  ],
  hostDirectives: [
    { directive: TuiBadge, inputs: ['size'] },
  ],
  templateUrl: './discussion-stats-badge.component.html',
  styleUrls: ['./discussion-stats-badge.component.scss'],
})
export class DiscussionStatsBadgeComponent {
  public readonly stats = input.required<{ participants: number; views: number }>();

}

