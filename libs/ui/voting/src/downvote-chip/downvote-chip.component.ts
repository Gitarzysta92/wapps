import { Component, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';

@Component({
  selector: 'downvote-chip',
  standalone: true,
  imports: [TuiIcon],
  hostDirectives: [
    {
      directive: TuiChip,
      inputs: ['size']
    }
  ],
  templateUrl: './downvote-chip.component.html',
  styleUrl: './downvote-chip.component.scss'
})
export class DownvoteChipComponent {
  public readonly count = input.required<number>();
}
