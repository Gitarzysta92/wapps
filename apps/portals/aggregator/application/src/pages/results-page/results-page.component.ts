import { Component, computed, inject, input } from '@angular/core';
import { PreferencesService, PreferredDatePipe } from '@portals/shared/features/preferences';
import { CommonModule } from '@angular/common';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import {
  BreadcrumbsComponent,
  BreadcrumbsSkeletonComponent,
} from '@ui/breadcrumbs';
import {
  PageHeaderComponent,
  PageTitleComponent,
  PageTitleSkeletonComponent,
  MediumCardSkeletonComponent,
  ContentStateComponent
} from '@ui/layout';
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import {
  browseCatalog,
  CATALOG_ENTRIES,
  catalogFacets,
  CatalogEntry,
  CatalogKind,
  CatalogQuery,
  CatalogSort,
  normalizeCatalogFacet,
} from '@portals/shared/features/listing';
import { TuiAvatar } from '@taiga-ui/kit';
import { TuiDropdownOpen, TuiDropdownDirective, TuiDropdownOptionsDirective } from '@taiga-ui/core/directives/dropdown';
import { CoverImageComponent } from '@ui/cover-image';
import { HeaderPartialComponent } from '../../partials/header/header.component';
import { NAVIGATION } from '../../navigation';
import { EntryDetailsDataService } from '../entry-details-page/entry-details-data.service';

@Component({
  selector: 'results-page',
  standalone: true,
  templateUrl: './results-page.component.html',
  styleUrl: './results-page.component.scss',
  host: { class: 'fluid-container' },
  imports: [
    ContentStateComponent,
    CommonModule,
    PreferredDatePipe,
    RouterLink,
    TuiButton,
    TuiAppearance,
    TuiLink,
    TuiAvatar,
    CoverImageComponent,
    HeaderPartialComponent,
    TuiDropdownOpen,
    TuiDropdownDirective,
    TuiDropdownOptionsDirective,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
    PageHeaderComponent,
    PageTitleComponent,
    PageTitleSkeletonComponent,
    MediumCardSkeletonComponent,
  ],
})
export class ResultsPageComponent {
  filtersOpen = false;
  readonly searchLabel = computed(() => this.kind() === 'all' ? 'Search this catalog' : 'Search ' + this.kind());
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly preferences = inject(PreferencesService, { optional: true });
  readonly pageSizeOptions = [3, 6, 10, 12, 20, 24, 50, 100];
  private readonly details = inject(EntryDetailsDataService);
  readonly kind = input<CatalogKind | 'all'>('applications');
  readonly browse = input<'category' | 'tag' | null>(null);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly view = computed(() => {
    const explicit = this.queryParams().get('view');
    return explicit === 'grid' || explicit === 'list' ? explicit : this.preferences?.defaultView() ?? 'grid';
  });
  readonly pathCategory = computed(
    () =>
      this.params().get('categorySlug') ?? this.params().get('category') ?? ''
  );
  readonly pathTag = computed(
    () => this.params().get('tagSlug') ?? this.params().get('tag') ?? ''
  );
  readonly query = computed<CatalogQuery>(() => {
    const params = this.queryParams();
    const type = params.get('type');
    const kind =
      this.kind() === 'all'
        ? ['applications', 'articles', 'suites'].includes(type ?? '')
          ? (type as CatalogKind)
          : undefined
        : (this.kind() as CatalogKind);
    const sort = params.get('sort');
    const pageSize = Number(params.get('pageSize'));
    return {
      kind,
      search: params.get('search') ?? params.get('q') ?? '',
      category: this.pathCategory() || params.get('category') || '',
      platform: params.getAll('platform').join(','),
      device: params.getAll('device').join(','),
      monetization: params.getAll('monetization').join(','),
      tags: [
        ...new Set(
          [this.pathTag(), ...params.getAll('tag'), ...params.getAll('tags')]
            .flatMap((tag) => tag.split(','))
            .filter(Boolean)
        ),
      ],
      sort: ([
        'name',
        'name-desc',
        ...(kind === 'suites' ? [] : ['newest']),
      ].includes(sort ?? '')
        ? sort
        : 'name') as CatalogSort,
      page: Number(params.get('page') ?? this.params().get('page') ?? 1),
      pageSize: this.pageSizeOptions.includes(pageSize) ? pageSize : this.preferences?.itemsPerPage() ?? 20,
    };
  });
  readonly entries = computed<readonly CatalogEntry[]>(() => [
    ...CATALOG_ENTRIES.filter((entry) => entry.kind !== 'suites'),
    ...this.details.listSuites().map((suite) => {
      const fixture = CATALOG_ENTRIES.find(
        (entry) => entry.kind === 'suites' && entry.slug === suite.slug
      );
      return {
        ...fixture,
        kind: 'suites' as const,
        slug: suite.slug,
        name: suite.title,
        description:
          suite.description ||
          fixture?.description ||
          suite.apps.map((app) => app.name).join(', '),
        author: suite.author ?? fixture?.author,
        categories: fixture?.categories.length
          ? fixture.categories
          : [
              {
                name: suite.category,
                slug: normalizeCatalogFacet(suite.category),
              },
            ],
        tags: fixture?.tags ?? [],
        applications: suite.apps.map((app) => ({
          name: app.name,
          slug: app.slug ?? '',
        })),
      };
    }),
  ]);
  readonly result = rxResource({
    request: this.query,
    loader: ({ request }) => of(browseCatalog(request, this.entries())),
  });
  readonly scopeEntries = computed(() =>
    this.entries().filter(
      (entry) => !this.query().kind || entry.kind === this.query().kind
    )
  );
  readonly applicationFilters = computed(() => {
    const apps = this.entries().filter(entry => entry.kind === 'applications');
    return [
      { key: 'platform' as const, label: 'Platform', options: catalogFacets(apps, 'platforms') },
      { key: 'device' as const, label: 'Device', options: catalogFacets(apps, 'devices') },
      { key: 'monetization' as const, label: 'Monetization', options: catalogFacets(apps, 'monetizations') },
    ];
  });
  selectedApplicationFilter(key: 'platform' | 'device' | 'monetization'): string {
    const selection = this.query()[key] ?? '';
    return this.applicationFilters().find(control => control.key === key)?.options.find(option =>
      normalizeCatalogFacet(option.slug) === normalizeCatalogFacet(selection) || String(option.id) === selection
    )?.slug ?? selection;
  }
  readonly categories = computed(() =>
    catalogFacets(this.scopeEntries(), 'categories')
  );
  readonly tags = computed(() => catalogFacets(this.scopeEntries(), 'tags'));
  readonly title = computed(() => {
    if (this.browse() === 'category')
      return (
        this.facetName('categories', this.pathCategory()) || 'Browse categories'
      );
    if (this.browse() === 'tag')
      return this.facetName('tags', this.pathTag()) || 'Browse tags';
    return {
      applications: 'Discover applications',
      articles: 'Articles',
      suites: 'Application suites',
      all: 'Browse the catalog',
    }[this.kind()];
  });
  readonly breadcrumb = computed(() => [
    NAVIGATION.home,
    {
      label: this.title(),
      icon: '@tui.layout-grid',
      path: this.router.url.split('?')[0],
    },
  ]);
  readonly directory = computed(() =>
    this.browse() === 'category' && !this.pathCategory()
      ? this.categories()
      : this.browse() === 'tag' && !this.pathTag()
      ? this.tags()
      : []
  );
  readonly activeFilters = computed(
    () =>
      !!(
        this.query().search ||
        this.query().category ||
        this.query().tags.length ||
        this.query().platform || this.query().device || this.query().monetization ||
        (this.kind() === 'all' && this.query().kind)
      )
  );
  readonly cards = computed(
    () =>
      this.result
        .value()
        ?.items.map((entry) => ({ ...entry, path: this.detailPath(entry) })) ??
      []
  );
  readonly selectedTag = computed(
    () =>
      this.tags().find(
        (tag) =>
          normalizeCatalogFacet(tag.slug) ===
          normalizeCatalogFacet(this.query().tags[0] ?? '')
      )?.slug ??
      this.query().tags[0] ??
      ''
  );
  readonly selectedCategory = computed(
    () =>
      this.categories().find(
        (category) =>
          normalizeCatalogFacet(category.slug) ===
          normalizeCatalogFacet(this.query().category)
      )?.slug ?? this.query().category
  );
  readonly hasDatedEntries = computed(() =>
    this.scopeEntries().some((entry) => !!entry.date)
  );

  private facetName(key: 'categories' | 'tags', slug: string): string {
    if (!slug) return '';
    return (
      catalogFacets(this.entries(), key).find(
        (item) =>
          normalizeCatalogFacet(item.slug) === normalizeCatalogFacet(slug)
      )?.name ?? slug
    );
  }
  detailPath(entry: CatalogEntry): string {
    const navigation = {
      applications: NAVIGATION.application,
      articles: NAVIGATION.article,
      suites: NAVIGATION.suite,
    }[entry.kind];
    return buildRoutePath(
      navigation.path,
      { appSlug: entry.slug, articleSlug: entry.slug, suiteSlug: entry.slug },
      { absolute: true }
    );
  }
  facetPath(type: 'category' | 'tag', slug: string): string[] {
    // RouterLink encodes each raw segment once. Tags share a semantic slug
    // even when their fixture spelling contains spaces or capitals.
    const root =
      type === 'category' ? NAVIGATION.categories.path : NAVIGATION.tags.path;
    return ['/', root, type === 'tag' ? normalizeCatalogFacet(slug) : slug];
  }
  update(values: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { page: 1, ...values },
    });
  }
  filter(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.update({
      [key]: value || null,
      ...(key === 'tag' ? { tags: null } : {}),
      ...(key === 'search' ? { q: null } : {}),
    });
  }
  clearFilters(): void {
    // Path constraints must also be removed, not just hidden by clearing query parameters.
    const path =
      this.browse() === 'category'
        ? NAVIGATION.categories.path
        : this.browse() === 'tag'
        ? NAVIGATION.tags.path
        : this.kind() === 'articles'
        ? NAVIGATION.articles.path
        : this.kind() === 'suites'
        ? NAVIGATION.suites.path
        : NAVIGATION.discover.path;
    void this.router.navigate([buildRoutePath(path, {}, { absolute: true })]);
  }
}
