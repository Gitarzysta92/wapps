import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import { TuiCardLarge } from '@taiga-ui/layout';
import { ContentStateComponent } from '@ui/layout';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import { ExploreService } from '../../application/explore.service';
import { EXPLORE_LINK } from '../../application/explore.port';

@Component({
  selector: 'explore-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
  providers: [ExploreService],
  imports: [
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiLink,
    TuiCardLarge,
    ContentStateComponent,
    PreferredDatePipe,
  ],
})
export class ExploreComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  timestamp(at: number) {
    return new Date(at).toISOString();
  }
  readonly feed = inject(ExploreService);
  readonly link = inject(EXPLORE_LINK);
  constructor() {
    this.route.queryParamMap
      .pipe(
        map((params) => params.get('activity')),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe((after) => this.feed.open(after));
  }
  latest() {
    if (this.route.snapshot.queryParamMap.has('activity'))
      void this.navigate(null);
    else this.feed.reload(true);
  }
  older() {
    if (this.feed.after() && !this.feed.loading())
      void this.navigate(this.feed.after());
  }
  private navigate(after: string | null) {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { activity: after },
      queryParamsHandling: 'merge',
      fragment: 'explore',
    });
  }
  readonly labels = {
    application: 'Application update',
    suite: 'Suite publication',
    article: 'Article publication',
    release: 'Release',
    discussion: 'Discussion',
    review: 'Member review',
  };
}
