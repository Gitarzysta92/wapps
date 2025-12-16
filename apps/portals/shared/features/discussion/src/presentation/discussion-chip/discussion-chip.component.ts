import { Component, input } from '@angular/core';
import { TuiChip } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'discussion-chip',
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
  templateUrl: './discussion-chip.component.html',
  styleUrl: './discussion-chip.component.scss'
})
export class DiscussionChipComponent {
  public readonly commentsCount = input.required<number>();
}


