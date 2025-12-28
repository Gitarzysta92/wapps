import { Component, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';

@Component({
  selector: 'changelog-rating-chip',
  standalone: true,
  imports: [
    TuiIcon
  ],
  hostDirectives: [
    {
      directive: TuiChip,
      inputs: ['size']
    },
  ],
  templateUrl: './changelog-rating-chip.component.html',
  styleUrl: './changelog-rating-chip.component.scss'
})
export class ChangelogRatingChipComponent {
  public readonly upvotesCount = input.required<number>();
  public readonly downvotesCount = input.required<number>();
}
