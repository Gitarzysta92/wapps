import { Component, input } from '@angular/core';
import { TuiChip } from '@taiga-ui/kit';
import { VotingIndicatorComponent } from '@ui/voting';

export interface AppVotingData {
  upvotesCount: number;
  downvotesCount: number;
}

@Component({
  selector: 'app-voting-chip',
  standalone: true,
  imports: [TuiChip, VotingIndicatorComponent],
  templateUrl: './app-voting-chip.component.html',
  styleUrl: './app-voting-chip.component.scss'
})
export class AppVotingChipComponent {
  voting = input.required<AppVotingData>();
}

