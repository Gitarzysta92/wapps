import { Component, input } from '@angular/core';
import { TuiChip } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'article-rating',
  standalone: true,
  imports: [TuiChip, TuiIcon],
  templateUrl: './article-rating.component.html',
  styleUrl: './article-rating.component.scss'
})
export class ArticleRatingComponent {
  rating = input.required<number>();
  readonly = input<boolean>(false);
}


