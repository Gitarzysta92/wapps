import { Component, Input } from "@angular/core";
import { TuiIcon } from "@taiga-ui/core";

@Component({
  selector: 'voting-indicator',
  templateUrl: './voting-indicator.component.html',
  styleUrl: './voting-indicator.component.scss',
  standalone: true,
  imports: [
    TuiIcon
  ]
})
export class VotingIndicatorComponent {
  @Input() upvotesCount: number = 0;
  @Input() downvotesCount: number = 0;
}

