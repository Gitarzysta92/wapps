import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import type { MemberReview } from '@sdk/features/review/core';
import { ReviewsService } from '../../application/reviews.service';

@Component({
  selector: 'member-reviews',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    DecimalPipe,
    RouterLink,
    TuiButton,
    TuiAppearance,
  ],
  templateUrl: './member-reviews.component.html',
  styleUrl: './member-reviews.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberReviewsComponent {
  readonly reviews = inject(ReviewsService);
  readonly detail = input(false);
  readonly reviewLink = input.required<(id: string) => string>();
  readonly locked = computed(
    () =>
      this.reviews.saving() ||
      !!this.reviews.pending() ||
      this.reviews.loading() ||
      !!this.reviews.error()
  );
  readonly stars = [5, 4, 3, 2, 1];
  editing = false;
  displayName = '';
  rating = 5;
  text = '';
  reportId: string | null = null;
  reportReason = '';
  moderateId: string | null = null;
  moderationReason = '';
  hidden = true;
  constructor() {
    effect(() => {
      this.reviews.sessionVersion();
      this.reset();
    });
    effect(() => {
      this.reviews.contextVersion();
      this.reset();
    });
    effect(() => {
      this.reviews.published();
      this.reset();
    });
  }
  edit() {
    const mine = this.reviews.mine();
    this.displayName = mine?.content.displayName ?? '';
    this.rating = mine?.content.rating ?? 5;
    this.text = mine?.content.text ?? '';
    this.editing = true;
  }
  save() {
    this.reviews.publish({
      displayName: this.displayName,
      rating: Number(this.rating),
      text: this.text,
    });
  }
  showReport(item: MemberReview) {
    this.reportId = item.id;
    this.reportReason = '';
  }
  showModeration(item: MemberReview) {
    this.moderateId = item.id;
    this.hidden = !item.hidden;
    this.moderationReason = '';
    this.reviews.loadReports(item.id);
  }
  private reset() {
    this.editing = false;
    this.displayName = '';
    this.rating = 5;
    this.text = '';
    this.reportId = null;
    this.reportReason = '';
    this.moderateId = null;
    this.moderationReason = '';
  }
}
