import { Component, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'article-rating',
  standalone: true,
  imports: [TuiIcon],
  templateUrl: './article-rating.component.html',
  styleUrl: './article-rating.component.scss'
})
export class ArticleRatingComponent {
  rating = input.required<number>();
  readonly = input<boolean>(false);
}


