import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import { ApplicationTimelineService } from '@portals/shared/features/feed';
import {
  ApplicationContentStateComponent,
  readApplicationContent,
} from '@portals/shared/features/application-overview';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
} from '@ui/layout';
import { NAVIGATION } from '../../navigation';
import { exploreLink } from '../../explore-links';

@Component({
  selector: 'application-timeline-api-page',
  imports: [
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiLink,
    PreferredDatePipe,
    BreadcrumbsComponent,
    ContentStateComponent,
    PageHeaderComponent,
    PageTitleComponent,
    ApplicationContentStateComponent,
  ],
  providers: [ApplicationTimelineService],
  templateUrl: './application-timeline-api-page.component.html',
  styleUrl: './application-timeline-api-page.component.scss',
})
export class ApplicationTimelineApiPageComponent {
  readonly timeline = inject(ApplicationTimelineService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly selection = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap]),
    {
      initialValue: [
        this.route.snapshot.paramMap,
        this.route.snapshot.queryParamMap,
      ],
    }
  );
  readonly app = readApplicationContent(
    () => this.selection()[0].get('appSlug') ?? ''
  );
  readonly link = exploreLink;
  readonly breadcrumbs = computed(() => {
    const app = this.app.application();
    return [
      NAVIGATION.home,
      {
        label: app?.name ?? 'Application',
        path: app ? `/apps/${app.slug}/overview` : '/app',
      },
      { label: 'Timeline', path: '' },
    ];
  });
  readonly labels = {
    application: 'Application update',
    suite: 'Suite publication',
    article: 'Article publication',
    release: 'Release',
    discussion: 'Discussion',
    review: 'Member review',
  };
  constructor() {
    effect(() => {
      const slug = this.app.application()?.slug ?? '',
        after = this.selection()[1].get('activity');
      untracked(() => this.timeline.open(slug, after));
    });
  }
  timestamp(at: number) {
    return new Date(at).toISOString();
  }
  refresh() {
    if (!this.app.application()) {
      this.app.reload();
      return;
    }
    if (this.route.snapshot.queryParamMap.has('activity'))
      void this.navigate(null);
    else this.timeline.reload(true);
  }
  older() {
    if (
      this.app.application() &&
      !this.timeline.loading() &&
      this.timeline.after()
    )
      void this.navigate(this.timeline.after());
  }
  private navigate(after: string | null) {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { activity: after },
      queryParamsHandling: 'merge',
    });
  }
}
