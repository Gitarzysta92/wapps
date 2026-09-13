import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { ContentStateComponent, PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { SearchBarComponent } from '@ui/search-bar';
import { PreferencesService } from '@portals/shared/features/preferences';
import { catalogDirectory, CatalogDirectoryEntry, CatalogDirectoryKind, searchCatalogDirectory } from '@portals/shared/features/listing';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'catalog-directory-page',
  standalone: true,
  templateUrl: './catalog-directory-page.component.html',
  styleUrl: './catalog-directory-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TuiAppearance, TuiButton, TuiIcon, TuiAvatar,
    BreadcrumbsComponent, ContentStateComponent, PageHeaderComponent, PageTitleComponent, SearchBarComponent],
})
export class CatalogDirectoryPageComponent {
  readonly kind = input.required<CatalogDirectoryKind>();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly preferences = inject(PreferencesService, { optional: true });
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  @ViewChild(SearchBarComponent) private searchBar?: SearchBarComponent;
  readonly search = computed(() => this.params().get('search') ?? this.params().get('q') ?? '');
  readonly noun = computed(() => this.kind() === 'category' ? 'categories' : 'tags');
  readonly title = computed(() => this.kind() === 'category' ? 'Browse categories' : 'Browse tags');
  readonly breadcrumb = computed(() => [NAVIGATION.home, this.kind() === 'category' ? NAVIGATION.categories : NAVIGATION.tags]);
  readonly view = computed(() => {
    const view = this.params().get('view');
    return view === 'list' || view === 'grid' ? view : this.preferences?.defaultView() ?? 'grid';
  });
  readonly entries = computed(() => catalogDirectory(this.kind()));
  readonly matchingEntries = computed(() => searchCatalogDirectory(this.entries(), this.search()));
  readonly visibleCount = signal(24);
  readonly visibleEntries = computed(() => this.matchingEntries().slice(0, this.visibleCount()));

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.searchBar?.form.controls.search.setValue(params.get('search') ?? params.get('q') ?? '', { emitEvent: false });
    });
    effect(() => {
      this.search();
      this.kind();
      this.visibleCount.set(24);
    });
  }

  searchDirectory(value: string | null): void {
    const search = (value ?? '').trim().replace(/\s+/g, ' ');
    if (search === this.search()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: search || null, view: this.params().get('view') },
    });
  }
  submitSearch(event: Event): void {
    event.preventDefault();
    this.searchDirectory(this.searchBar?.form.controls.search.value ?? '');
  }
  setView(view: 'grid' | 'list'): void {
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { search: this.search() || null, view },
    });
  }
  showMore(): void { this.visibleCount.update(count => count + 24); }
  facetPath(entry: CatalogDirectoryEntry): string[] { return ['/', this.noun(), entry.slug]; }
  icon(entry: CatalogDirectoryEntry): string {
    if (this.kind() === 'tag') return '@tui.hash';
    const icons: Record<string, string> = {
      'work-productivity': '@tui.briefcase', 'engineering-development': '@tui.code',
      'design-creative': '@tui.palette', finance: '@tui.wallet', 'social-community': '@tui.users',
      'marketing-sales': '@tui.megaphone', ai: '@tui.sparkles', 'health-fitness': '@tui.heart',
      travel: '@tui.compass', web3: '@tui.boxes', ecommerce: '@tui.shopping-bag',
    };
    return icons[entry.rootSlug ?? ''] ?? '@tui.folder';
  }
}
