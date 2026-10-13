import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiLink } from '@taiga-ui/core';
import {
  ReviewsService,
  provideReviews,
} from '@portals/shared/features/review';
import { API_BASE_URL } from '../../environment';

@Component({
  selector: 'application-review-summary',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TuiLink],
  providers: [provideReviews(API_BASE_URL)],
  template: `
    @if (request.isLoading()) {
    <span role="status">Loading member ratings...</span> } @else {
    @if (summary(); as summary) {
    <a tuiLink [routerLink]="reviewsLink()"
      >{{
        summary.average === null
          ? 'No member ratings yet'
          : (summary.average | number : '1.1-1') + '/5 from members'
      }}
      ({{ summary.total }} reviews)</a
    >
    } @else { <span>Member ratings unavailable.</span>
    <button tuiLink type="button" (click)="request.reload()">
      Reload ratings
    </button>
    } }
  `,
  styleUrl: './application-review-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationReviewSummaryComponent {
  readonly applicationId = input.required<string>();
  readonly reviewsLink = input.required<string>();
  private readonly reviews = inject(ReviewsService);
  readonly request = rxResource({
    request: () => this.applicationId(),
    loader: ({ request }) => this.reviews.summaryFor(request),
  });
  readonly summary = computed(() => {
    const result = this.request.value();
    return !this.request.isLoading() && result?.ok ? result.value : null;
  });
}
