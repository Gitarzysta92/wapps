import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Input,
  NgZone,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { InfiniteScrollDirective } from '@ui/infinite-scroll';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import { ActivityCardComponent } from './activity-card.component';
import { ContentStateComponent, MediumCardComponent } from '@ui/layout';
import { ExploreService } from '../../application/explore.service';
import {
  EXPLORE_LINK,
  type ExploreLinkTarget,
} from '../../application/explore.port';
import {
  mapExploreFeedItem,
  type ExploreFeedItemVM,
} from '../mappers/explore-feed-item.mapper';

@Component({
  selector: 'explore-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
  providers: [ExploreService],
  imports: [
    InfiniteScrollDirective,
    NgTemplateOutlet,
    TuiAppearance,
    TuiButton,
    ActivityCardComponent,
    ContentStateComponent,
    MediumCardComponent,
  ],
})
export class ExploreComponent {
  @Input() itemTemplate?: TemplateRef<{ $implicit: ExploreFeedItemVM }>;
  @Input() continuous = false;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly resolveLink = inject(EXPLORE_LINK);
  private readonly zone = inject(NgZone);
  readonly feed = inject(ExploreService);
  readonly cards = computed(() =>
    this.feed.items().map((item) => ({
      source: item,
      presentation: mapExploreFeedItem(item, (target) => this.path(target)),
    }))
  );
  private path(target: ExploreLinkTarget): string {
    const destination = this.resolveLink(target);
    return this.router.serializeUrl(
      this.router.createUrlTree(
        Array.isArray(destination.path) ? destination.path : [destination.path],
        { queryParams: destination.query }
      )
    );
  }
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
    if (this.continuous) {
      this.feed.more();
      return;
    }
    if (this.feed.after() && !this.feed.loading())
      void this.navigate(this.feed.after());
  }
  scrolledToBottom() {
    if (this.continuous && this.feed.items().length) this.zone.run(() => this.feed.more());
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
