import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import { ActivityCardComponent } from './activity-card.component';
import { ContentStateComponent, MediumCardComponent } from '@ui/layout';
import { ExploreService } from '../../application/explore.service';

@Component({
  selector: 'explore-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
  providers: [ExploreService],
  imports: [
    TuiAppearance,
    TuiButton,
    ActivityCardComponent,
    ContentStateComponent,
    MediumCardComponent,
  ],
})
export class ExploreComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly feed = inject(ExploreService);
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
}
