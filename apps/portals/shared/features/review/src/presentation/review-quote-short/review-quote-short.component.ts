import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'review-quote-short',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review-quote-short.component.html',
  styleUrls: ['./review-quote-short.component.scss'],
})
export class ReviewQuoteShortComponent {
  public readonly quote = input.required<string>();
}
