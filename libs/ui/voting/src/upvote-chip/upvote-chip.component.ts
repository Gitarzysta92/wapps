import { Component, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';

@Component({
  selector: 'upvote-chip',
  standalone: true,
  imports: [TuiIcon],
  hostDirectives: [
    {
      directive: TuiChip,
      inputs: ['size']
    }
  ],
  templateUrl: './upvote-chip.component.html',
  styleUrl: './upvote-chip.component.scss'
})
export class UpvoteChipComponent {
  public readonly count = input.required<number>();
}

