import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TuiButton } from '@taiga-ui/core';
import { SearchBarComponent } from '@ui/search-bar';
import { DiscoverySearchService, normalizeSearch } from '@portals/shared/features/search';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'header',
  templateUrl: 'header.component.html',
  styleUrl: 'header.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchBarComponent, TuiButton],
})
export class HeaderPartialComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly searchService = inject(DiscoverySearchService);
  @ViewChild(SearchBarComponent) private searchBar?: SearchBarComponent;
  protected initialSearch = '';

  // Retain the layout inputs/outputs while the parent owns header placement.
  @Input() showCollapseButton = false;
  @Input() searchWithinPage = false;
  @Input() searchLabel = 'Search applications, articles and suites';
  @Output() expandedStateChange = new EventEmitter<boolean>();

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.initialSearch = params.get('search') ?? params.get('q') ?? '';
      this.searchBar?.form.controls.search.setValue(this.initialSearch, { emitEvent: false });
    });
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    const phrase = normalizeSearch(this.searchBar?.form.controls.search.value ?? '');
    if (this.searchWithinPage) {
      this.searchListing(phrase);
      if (phrase) this.searchService.remember(phrase);
      return;
    }
    if (!phrase) return;
    this.searchService.remember(phrase);
    void this.router.navigate(['/' + NAVIGATION.discover.path], { queryParams: { search: phrase } });
  }

  protected searchListing(value: string | null): void {
    if (!this.searchWithinPage) return;
    const search = normalizeSearch(value ?? '');
    if (search === this.initialSearch) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: search || null, q: null, page: 1 },
      queryParamsHandling: 'merge',
    });
  }
}
