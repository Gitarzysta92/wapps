import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * ARCH: Review Author Badge Component
 * 
 * This component displays review author information in a badge format.
 * It shows the reviewer's name, role, and review date in a compact, styled layout.
 */
@Component({
  selector: 'review-author-badge',
  standalone: true,
  imports: [
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review-author-badge.component.html',
  styleUrls: ['./review-author-badge.component.scss'],
})
export class ReviewAuthorBadgeComponent {
  public readonly reviewerName = input.required<string>();
  public readonly reviewDate = input<string | Date>('');
}
