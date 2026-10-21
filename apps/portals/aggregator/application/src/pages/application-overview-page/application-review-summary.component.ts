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
import { map } from 'rxjs';
import { AppRatingComponent } from '@portals/shared/features/application-overview';
import {
  ReviewsService,
  provideReviews,
} from '@portals/shared/features/review';
import { API_BASE_URL } from '../../environment';

@Component({
  selector: 'application-review-summary',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TuiLink, AppRatingComponent],
  providers: [provideReviews(API_BASE_URL)],
  template: `
    @if (loading()) {
    <div class="rating-skeleton" role="status" aria-label="Loading ratings"></div> } @else {
    @if (summary(); as summary) {
    <app-rating [readonly]="true" [rating]="summary.average" unavailableLabel="No reviews yet" />
    @if (summary.average !== null) {
    <span class="rating-text">{{ summary.average | number : '1.1-1' }}/5</span>
    }
    <a tuiLink class="reviews-count" [routerLink]="reviewsLink()">({{ summary.total }} {{ summary.total === 1 ? 'review' : 'reviews' }})</a>
    } @else { <app-rating [readonly]="true" [rating]="null" />
    <span class="reviews-count">Member ratings unavailable.</span>
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
  private readonly selected = computed(() => ({
    applicationId: this.applicationId(),
    session: this.reviews.sessionVersion(),
  }));
  readonly request = rxResource({
    request: this.selected,
    loader: ({ request }) => this.reviews.summaryFor(request.applicationId).pipe(
      map((result) => ({ request, result }))
    ),
  });
  readonly loading = computed(() => this.request.isLoading() ||
    (!this.request.error() && this.request.value()?.request !== this.selected()));
  readonly summary = computed(() => {
    if (this.loading() || this.request.error()) return null;
    const response = this.request.value();
    return response?.request === this.selected() && response.result.ok ? response.result.value : null;
  });
}
