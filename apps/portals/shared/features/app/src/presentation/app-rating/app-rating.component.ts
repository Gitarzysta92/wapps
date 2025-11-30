import { Component, input } from '@angular/core';
import { TuiChip } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'app-rating',
  standalone: true,
  imports: [TuiChip, TuiIcon],
  templateUrl: './app-rating.component.html',
  styleUrl: './app-rating.component.scss'
})
export class AppRatingComponent {
  rating = input.required<number>();
  readonly = input<boolean>(false);
}


