import { Component, computed, effect, inject, untracked } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import { ApplicationHealthService } from '@apps/portals/shared/features/health-status';
import {
  ApplicationContentStateComponent,
  readApplicationContent,
} from '@portals/shared/features/application-overview';
import type { HealthDay, HealthReason } from '@domains/reliability';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
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
    BreadcrumbsComponent,
    ContentStateComponent,
    PageHeaderComponent,
    PageTitleComponent,
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
  readonly labels = {
    operational: 'Responding',
    degraded: 'Slow response',
    outage: 'Check failed',
    unknown: 'Unknown',
    stale: 'Stale',
  };
  readonly reasons: Record<HealthReason, string> = {
    'http-success': 'The endpoint returned a successful HTTP response.',
    'http-slow': 'The endpoint responded successfully in two seconds or more.',
    'http-error': 'The endpoint returned an unsuccessful HTTP response.',
    timeout: 'The request timed out after ten seconds.',
    'network-error':
      'The network or secure connection could not be verified. Availability is unknown.',
    'blocked-target':
      'The endpoint did not meet the public-network check requirements. Availability is unknown.',
    redirect:
      'The endpoint redirected the request. The destination was not checked.',
    'access-denied':
      'The endpoint denied access to the check. Availability is unknown.',
  };
  readonly breadcrumbs = computed(() => {
    const app = this.app.application();
    return [
      NAVIGATION.home,
      {
        label: app?.name ?? 'Application',
        path: app ? `/apps/${app.slug}/overview` : '/app',
      },
      { label: 'Health', path: '' },
    ];
  });
  constructor() {
    effect(() => {
      const slug = this.app.application()?.slug ?? '';
      untracked(() => this.health.open(slug));
    });
  }
  refresh() {
    if (this.app.application()) this.health.reload();
    else this.app.reload();
  }
  dayLabel(day: HealthDay) {
    return `${new Date(day.day).toISOString().slice(0, 10)} UTC: ${
      this.labels[day.status]
    }; ${day.measured} of ${day.expected} intervals measured; ${
      day.availabilityPercent === null
        ? 'availability unknown'
        : day.availabilityPercent + '% sampled availability'
    }`;
  }
}
