import { Component, Input } from "@angular/core";
import { TuiButton, TuiIcon } from "@taiga-ui/core";
import { TuiBadge, TuiBadgedContent, TuiBadgeNotification } from "@taiga-ui/kit";

@Component({
  selector: 'discussion-indicator',
  templateUrl: './discussion-indicator.component.html',
  styleUrl: './discussion-indicator.component.scss',
  standalone: true,
  imports: [

    TuiIcon,
    TuiBadgedContent,
    TuiBadgeNotification
  ]
})
export class DiscussionIndicatorComponent {
  @Input() commentsCount: number = 0;
  @Input() newMessagesCount: number = 0;
}

