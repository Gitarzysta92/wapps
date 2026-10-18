import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
  effect,
  inject,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink, TuiDropdown } from '@taiga-ui/core';
import type { DiscoveryKind, PublicDiscoveryItem, DiscoveryDetails, DiscoveryReviews } from '@domains/discovery';
import { DiscoveryResultsService } from '@portals/shared/features/search';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { SearchBarComponent } from '@ui/search-bar';
import { FiltersMultiselectComponent } from '@ui/filters';
import { TagsComponent } from '@ui/tags';
import { MediumTitleComponent, ExcerptComponent } from '@ui/content';
import { AppAvatarComponent, AppRatingComponent, AppReviewsChipComponent } from '@portals/shared/features/application-overview';
import { ArticleAuthorInfoComponent } from '@ui/article-author-info';
import { ArticleCoverImageComponent, provideArticleCovers } from '@portals/shared/features/articles';
import { SuiteAppAvatarsComponent } from '@portals/shared/features/suite';
import { TopReviewCardComponent } from '@portals/shared/features/review';
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import { CatalogBrowserService } from '@portals/shared/features/listing';
import { FilterDefinition, FiltersBarComponent, FilterSelectionDialogResult } from '../../partials/filters-bar/src';
import {
  ContentStateComponent,
  PageHeaderComponent,
  PageTitleComponent,
  CommonSectionComponent,
  MediumCardComponent,
  CardHeaderComponent,
  MediumCardSkeletonComponent,
} from '@ui/layout';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'discover-api-page',
  imports: [
    AsyncPipe,
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiLink,
    BreadcrumbsComponent,
    ContentStateComponent,
    PageHeaderComponent,
    PageTitleComponent,
    SearchBarComponent,
    FiltersBarComponent,
    FiltersMultiselectComponent,
    TuiDropdown,
    CommonSectionComponent,
    MediumCardComponent,
    CardHeaderComponent,
    MediumTitleComponent,
    MediumCardSkeletonComponent,
    ExcerptComponent,
    AppAvatarComponent,
    TagsComponent,
    AppRatingComponent, AppReviewsChipComponent, ArticleAuthorInfoComponent,
    ArticleCoverImageComponent, SuiteAppAvatarsComponent, TopReviewCardComponent, FavoriteToggleButtonComponent,
    PreferredDatePipe,
  ],
  providers: [DiscoveryResultsService, provideArticleCovers()],
  templateUrl: './discover-api-page.component.html',
  styleUrl: './discover-api-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverApiPageComponent {
  readonly Math = Math;
  readonly results = inject(DiscoveryResultsService);
  readonly searchBar = viewChild(SearchBarComponent);
  displayOptionsOpen = false;
  readonly filtersRequested = signal(false);
  private readonly catalog = inject(CatalogBrowserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly initialSearch = computed(() => this.params().get('search') ?? this.params().get('q') ?? '');
  readonly taxonomy = rxResource({
    request: () => this.filtersRequested() ? this.catalog.contentChoice() : undefined,
    loader: () => this.catalog.browse({ kind: 'applications', search: '', category: '', tags: [], sort: 'name', page: 1, pageSize: 1 }),
  });
  readonly filterDefinitions = computed<FilterDefinition[]>(() => {
    const facets = this.taxonomy.hasValue() ? this.taxonomy.value().facets : undefined;
    const type = this.params().get('type')?.replace(/s$/, '') ?? 'all';
    const articles = this.results.groups()?.find(group => group.kind === 'article')?.items ?? [];
    const articleOptions = (key: 'categories' | 'tags') => [...new Set(articles.flatMap(item => item[key]))].map(slug => ({ slug, name: slug }));
    return [
      { key: 'type', name: 'Content type', singleSelection: true, options: Object.entries(this.labels).map(([slug, name]) => ({ slug, name })) },
      ...(type === 'suite' ? [] : [
        { key: 'category', name: 'Category', singleSelection: type === 'article', options: type === 'article' ? articleOptions('categories') : facets?.categories ?? [] },
        { key: 'tag', name: 'Tag', singleSelection: type === 'article', options: type === 'article' ? articleOptions('tags') : facets?.tags ?? [] },
      ]),
      ...(type === 'article' || type === 'suite' ? [] : [
        { key: 'platform', name: 'Platform', options: facets?.platforms ?? [] },
        { key: 'device', name: 'Device', options: facets?.devices ?? [] },
        { key: 'monetization', name: 'Monetization', options: facets?.monetizations ?? [] },
      ]),
      { key: 'search', name: 'Search', options: [] },
    ];
  });
  readonly filterSelections = computed(() => Object.fromEntries(this.filterDefinitions().map(({ key }) => [key,
    key === 'search' ? (this.initialSearch() ? [this.initialSearch()] : [])
      : (key === 'tag' ? [...this.params().getAll('tag'), ...this.params().getAll('tags')] : this.params().getAll(key)).flatMap(value => value.split(',')).filter(Boolean).map(value => key === 'type' ? value.replace(/s$/, '') : value),
  ])));
  readonly breadcrumbs = [NAVIGATION.home, NAVIGATION.discover];
  readonly labels = {
    application: 'Applications',
    article: 'Articles',
    suite: 'Suites',
  };
  constructor() {
    effect(() => this.searchBar()?.form.controls.search.setValue(this.initialSearch(), { emitEvent: false }));
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
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
  }
  submitSearch(event?: Event) {
    event?.preventDefault();
    this.searchRecent(this.searchBar()?.form.controls.search.value?.trim() ?? '');
  }
  onFilterSelectionChange({ filterId, selected }: FilterSelectionDialogResult) {
    const value = selected.map(option => option.value).join(',') || null;
    if (filterId === 'type') { this.changeType(value ?? 'all'); return; }
    this.change({ [filterId]: value, ...(filterId === 'tag' ? { tags: null } : {}),
      ...(filterId === 'search' ? { q: null } : {}),
      ...(filterId !== 'search' && !this.params().get('type') ? { type: 'application' } : {}),
    });
  }
  tags(item: PublicDiscoveryItem, kind: DiscoveryKind) {
    return (item.displayTags ?? []).map(({ slug, name }) => ({ slug, name,
      link: kind === 'article' ? '/articles' : `/tags/${encodeURIComponent(slug)}`,
      ...(kind === 'article' ? { queryParams: { tags: slug } } : {}) }));
  }
  suiteApps(details: Extract<DiscoveryDetails, { kind: 'suite' }>) {
    return details.applications.map(app => ({ slug: app.slug, name: app.name, avatarUrl: app.logoUrl ?? '' }));
  }
  reviewPreview(review: NonNullable<DiscoveryReviews['preview']>, date: string) {
    return { authorName: review.byline, authorAvatarUrl: '', rating: review.rating, content: review.text, date };
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
