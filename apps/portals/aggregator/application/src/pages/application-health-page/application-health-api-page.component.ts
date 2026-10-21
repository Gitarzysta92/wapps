import { Component, computed, effect, inject, untracked } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TuiAppearance, TuiButton, TuiIcon } from '@taiga-ui/core';
import {
  ApplicationHealthService,
  applicationHealthView,
  HealthCheckBadgeComponent,
  StatusBannerComponent,
  StatusHistoryComponent,
} from '@apps/portals/shared/features/health-status';
import {
  ApplicationContentStateComponent,
  readApplicationContent,
} from '@portals/shared/features/application-overview';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';
import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
  PageTitleSkeletonComponent,
  PageMetaComponent,
  PageMetaSkeletonComponent,
  MediumCardComponent,
  MediumCardSkeletonComponent,
} from '@ui/layout';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'application-health-api-page',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiIcon,
    StatusBannerComponent,
    StatusHistoryComponent,
    HealthCheckBadgeComponent,
    MediumCardComponent,
    MediumCardSkeletonComponent,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
    ContentStateComponent,
    PageHeaderComponent,
    PageTitleComponent,
    PageTitleSkeletonComponent,
    PageMetaComponent,
    PageMetaSkeletonComponent,
    ApplicationContentStateComponent,
  ],
  providers: [ApplicationHealthService],
  templateUrl: './application-health-api-page.component.html',
  styleUrl: './application-health-api-page.component.scss',
})
export class ApplicationHealthApiPageComponent {
  readonly health = inject(ApplicationHealthService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly app = readApplicationContent(
    () => this.params().get('appSlug') ?? ''
  );
  readonly view = computed(() => {
    const app = this.app.application();
    const report = this.health.report();
    return app && report?.application.id === app.id && report.application.slug === app.slug
      ? applicationHealthView(report)
      : null;
  });
  readonly breadcrumbs = computed(() => {
    const app = this.app.application();
    return [
      { ...NAVIGATION.home, path: '/' },
      {
        label: app?.name ?? 'Application',
        path: app ? `/apps/${app.slug}/overview` : '/app',
      },
      { label: 'Health', path: '' },
    ];
  });
  constructor() {
    effect(() => {
      const app = this.app.application();
      untracked(() => this.health.open(app?.slug ?? '', app?.id));
    });
  }
  refresh() {
    if (this.app.application()) this.health.reload();
    else this.app.reload();
  }
}
