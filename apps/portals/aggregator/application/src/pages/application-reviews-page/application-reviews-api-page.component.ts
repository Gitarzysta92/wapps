import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiLink, TuiIcon } from '@taiga-ui/core';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import {
  ApplicationContentStateComponent,
  readApplicationContent,
} from '@portals/shared/features/application-overview';
import {
  MemberReviewsComponent,
  ReviewsService,
  provideReviews,
} from '@portals/shared/features/review';
import {
  buildRoutePath,
  type NavigationDeclarationDto,
} from '@portals/shared/boundary/navigation';
import { API_BASE_URL } from '../../environment';
import { NAVIGATION, NAVIGATION_NAME_PARAMS } from '../../navigation';

@Component({
  selector: 'app-application-reviews-api-page',
  standalone: true,
  imports: [
    RouterLink,
    TuiButton,
    TuiLink,
    TuiIcon,
    BreadcrumbsComponent,
    PageHeaderComponent,
    PageTitleComponent,
    ApplicationContentStateComponent,
    MemberReviewsComponent,
  ],
  providers: [provideReviews(API_BASE_URL)],
  templateUrl: './application-reviews-api-page.component.html',
  styleUrl: './application-reviews-api-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationReviewsApiPageComponent {
  readonly appSlug = input<string>('');
  readonly reviewSlug = input<string | null>(null);
  readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  readonly reviews = inject(ReviewsService);
  readonly app = readApplicationContent(this.appSlug);
  readonly application = this.app.application;
  readonly breadcrumbs = computed(() =>
    this.breadcrumb().map((entry) => ({
      ...entry,
      path: buildRoutePath('/' + entry.path.replace(/^\/+/, ''), {
        appSlug: this.appSlug(),
        reviewSlug: this.reviewSlug() ?? '',
      }),
      label: entry.label.replace(
        NAVIGATION_NAME_PARAMS.applicationName,
        this.application()?.name ?? 'Application'
      ),
    }))
  );
  readonly listLink = computed(() =>
    buildRoutePath('/' + NAVIGATION.applicationReviews.path, {
      appSlug: this.appSlug(),
    })
  );
  readonly overviewLink = computed(() =>
    buildRoutePath('/' + NAVIGATION.applicationOverview.path, {
      appSlug: this.appSlug(),
    })
  );
  readonly reviewLink = (id: string) =>
    buildRoutePath('/' + NAVIGATION.applicationReview.path, {
      appSlug: this.appSlug(),
      reviewSlug: id,
    });
  constructor() {
    effect(() => {
      const id = this.application()?.id ?? null,
        review = this.reviewSlug();
      untracked(() => this.reviews.open(id, review));
    });
  }
}
