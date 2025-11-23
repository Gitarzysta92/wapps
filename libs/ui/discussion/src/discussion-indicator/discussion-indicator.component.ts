import { Component, Input } from "@angular/core";
import { TuiIcon } from "@taiga-ui/core";
import { TuiBadgedContent } from "@taiga-ui/kit";

@Component({
  selector: 'discussion-indicator',
  templateUrl: './discussion-indicator.component.html',
  styleUrl: './discussion-indicator.component.scss',
  standalone: true,
  imports: [
    TuiIcon,
    TuiBadgedContent
  ]
})
export class DiscussionIndicatorComponent {
  @Input() commentsCount: number = 0;
  @Input() newMessagesCount: number = 0;
}

