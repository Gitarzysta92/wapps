import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'app-reviews-chip',
  standalone: true,
  imports: [TuiButton, TuiIcon, RouterLink],
  templateUrl: './app-reviews-chip.component.html',
  styleUrl: './app-reviews-chip.component.scss'
})
export class AppReviewsChipComponent {
  reviewsCount = input.required<number>();
  reviewsLink = input<string>();
  size = input<'xs' | 's' | 'm' | 'l'>('s');
  appearance = input<string>('flat');
  readonly = input<boolean>(false);
}




