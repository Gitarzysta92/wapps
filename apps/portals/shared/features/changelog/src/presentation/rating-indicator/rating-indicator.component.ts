import { Component, Input } from "@angular/core";
import { TuiIcon } from "@taiga-ui/core";

@Component({
  selector: 'rating-indicator',
  templateUrl: './rating-indicator.component.html',
  styleUrl: './rating-indicator.component.scss',
  standalone: true,
  imports: [
    TuiIcon
  ]
})
export class RatingIndicatorComponent {
  @Input() rating: number = 0;
}

