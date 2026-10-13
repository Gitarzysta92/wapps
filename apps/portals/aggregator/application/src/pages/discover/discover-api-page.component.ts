import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import type { DiscoveryKind, PublicDiscoveryItem } from '@domains/discovery';
import { DiscoveryResultsService } from '@portals/shared/features/search';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
} from '@ui/layout';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'discover-api-page',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiLink,
    PreferredDatePipe,
    BreadcrumbsComponent,
    ContentStateComponent,
    PageHeaderComponent,
    PageTitleComponent,
  ],
  providers: [DiscoveryResultsService],
  templateUrl: './discover-api-page.component.html',
  styleUrl: './discover-api-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverApiPageComponent {
  readonly results = inject(DiscoveryResultsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly breadcrumbs = [NAVIGATION.home, NAVIGATION.discover];
  readonly labels = {
    application: 'Applications',
    article: 'Articles',
    suite: 'Suites',
  };
  readonly form = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    type: new FormControl('all', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
    tag: new FormControl('', { nonNullable: true }),
    platform: new FormControl('', { nonNullable: true }),
    device: new FormControl('', { nonNullable: true }),
    monetization: new FormControl('', { nonNullable: true }),
  });
  readonly selectedType = new FormControl('all', { nonNullable: true });
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.form.setValue({
        search: params.get('search') ?? params.get('q') ?? '',
        type: params.get('type')?.replace(/s$/, '') ?? 'all',
        category: params.getAll('category').join(','),
        tag: [...params.getAll('tag'), ...params.getAll('tags')].join(','),
        platform: params.getAll('platform').join(','),
        device: params.getAll('device').join(','),
        monetization: params.getAll('monetization').join(','),
      });
      this.results.search(
        Object.fromEntries(
          params.keys.map((key) => [
            key,
            params.getAll(key).length > 1
              ? params.getAll(key)
              : params.get(key)!,
          ])
        )
      );
    });
    effect(() => {
      const query = this.results.query();
      const type =
        query && query.kinds.length < 3 ? query.kinds.join(',') : 'all';
      this.selectedType.setValue(type);
      if (query) this.form.controls.type.setValue(type);
    });
  }
  submit() {
    const values = this.form.getRawValue();
    this.change({
      ...values,
      type: values.type === 'all' ? null : values.type,
      search: values.search || null,
      q: null,
      tags: null,
    });
  }
  searchRecent(search: string) {
    this.change({ search, q: null });
  }
  changeType(type: string) {
    this.change({
      type: type === 'all' ? null : type,
      category: null,
      tag: null,
      tags: null,
      platform: null,
      device: null,
      monetization: null,
    });
  }
  change(values: Record<string, string | null>) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: {
        page: null,
        applicationPage: null,
        articlePage: null,
        suitePage: null,
        ...values,
      },
    });
  }
  page(kind: DiscoveryKind, page: number) {
    const pages = Object.fromEntries(
      (this.results.groups() ?? []).map((group) => [group.kind, group.page])
    );
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: {
        page: null,
        applicationPage: pages['application'] ?? 1,
        articlePage: pages['article'] ?? 1,
        suitePage: pages['suite'] ?? 1,
        [kind + 'Page']: page,
      },
      fragment: kind,
    });
  }
  link(kind: DiscoveryKind, item: PublicDiscoveryItem) {
    return kind === 'application'
      ? ['/apps', item.slug]
      : kind === 'article'
      ? ['/articles', item.slug]
      : ['/suites', item.id];
  }
  timestamp(at: number) {
    return new Date(at).toISOString();
  }
}
