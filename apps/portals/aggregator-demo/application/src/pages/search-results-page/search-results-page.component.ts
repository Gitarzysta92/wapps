import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FILTERS } from '../../filters';
import { ActivatedRoute, Router, RouterLink, UrlSegment } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import { combineLatest, filter, map, startWith, Subject } from 'rxjs';
import { FiltersBarComponent } from '../../partials/filters-bar/filters-bar.component';
import { FiltersPanelComponent } from '../../partials/filters-panel/filters-panel.component';

export interface ResultsPageConfig {
  title: string;
  filterKey?: string;
  showFilters?: boolean;
  showSorting?: boolean;
  showListing?: boolean;
}

@Component({
  selector: 'search-results-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TuiButton,
    FiltersBarComponent,
    FiltersPanelComponent
  ],
  templateUrl: './search-results-page.component.html',
  styleUrl: './search-results-page.component.scss',
  host: {
    'class': 'fluid-container'
  }
})
export class SearchResultsPageComponent implements OnInit {
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  
  public readonly filterKey = FILTERS;
  public readonly filterParams = new Subject<{ [key: string]: string[]; }>();
  public readonly listingParams = new Subject<{ page: string; }>();
  public readonly sortingParam = new Subject<{ sort: string; }>();

  public config: ResultsPageConfig = {
    title: 'Results',
    showFilters: true,
    showSorting: true,
    showListing: true
  };

  // Mock data for display
  public items = [
    { id: 1, name: 'Sample App 1', description: 'A great application for productivity', category: 'Productivity', rating: 4.5 },
    { id: 2, name: 'Sample App 2', description: 'Entertainment application', category: 'Entertainment', rating: 4.2 },
    { id: 3, name: 'Sample App 3', description: 'Educational tool', category: 'Education', rating: 4.8 },
    { id: 4, name: 'Sample App 4', description: 'Social networking platform', category: 'Social', rating: 4.0 },
    { id: 5, name: 'Sample App 5', description: 'Photo editing software', category: 'Graphics', rating: 4.6 },
    { id: 6, name: 'Sample App 6', description: 'Video streaming service', category: 'Entertainment', rating: 4.3 },
  ];

  public currentPage = 1;
  public totalPages = 5;
  public selectedCategory: string | null = null;
  public selectedTag: string | null = null;

  public ngOnInit(): void {
    this._determineConfigFromRoute();
    this._extractRouteParameters();
    this._handleNavigationOnRouteChange();
  }

  private _extractRouteParameters(): void {
    // Extract page number
    this._route.params.subscribe(params => {
      if (params['page']) {
        this.currentPage = parseInt(params['page'], 10);
      }
      if (params[FILTERS.category]) {
        this.selectedCategory = params[FILTERS.category];
      }
      if (params[FILTERS.tag]) {
        this.selectedTag = params[FILTERS.tag];
      }
    });
  }

  private _determineConfigFromRoute(): void {
    const path = this._route.snapshot.routeConfig?.path || '';
    
    // Determine configuration based on the route
    if (path.includes('category')) {
      this.config = {
        title: 'Categories',
        filterKey: FILTERS.category,
        showFilters: true,
        showSorting: true,
        showListing: true
      };
    } else if (path.includes('tag')) {
      this.config = {
        title: 'Tags',
        filterKey: FILTERS.tag,
        showFilters: true,
        showSorting: true,
        showListing: true
      };
    } else if (path.includes('applications')) {
      this.config = {
        title: 'Applications',
        showFilters: true,
        showSorting: true,
        showListing: true
      };
    } else if (path.includes('suites')) {
      this.config = {
        title: 'Suites',
        showFilters: true,
        showSorting: true,
        showListing: true
      };
    } else if (path.includes('articles')) {
      this.config = {
        title: 'Articles',
        showFilters: false,
        showSorting: true,
        showListing: true
      };
    }
  }

  private _handleNavigationOnRouteChange(): void {
    combineLatest([
      this.filterParams.pipe(startWith(undefined)),
      this.listingParams.pipe(startWith(undefined)),
      this.sortingParam.pipe(startWith(undefined)),
      this._route.url.pipe(map(() => this._route.routeConfig?.path?.split('/') ?? [])),
      this._route.url
    ]).pipe(
      filter(([f, l, s]) => !!f || !!l || !!s)
    ).subscribe(([
      filters = {},
      listing = {},
      sorting = {},
      config,
      url
    ]) => {
      const segments = this._buildSegments(url, config, listing, filters);
      const queryParams = this._buildQuery(config, { ...filters, ...listing, ...sorting });
      this._router.navigate(segments, { queryParams });
    });
  }

  private _buildSegments(
    routeSegments: UrlSegment[],
    routeConfigSegments: string[],
    paramValues: { [key: string]: string; },
    fallbackParamValues: { [key: string]: string[]; }
  ): string[] {
    return routeConfigSegments.map((p, i) => {
      const isParam = p.startsWith(':');
      const key = p.replace(':', '');
      const value = paramValues[key] ?? fallbackParamValues[key];
      if (isParam && value) {
        return value;
      }
      return routeSegments[i]?.path || '';
    });
  }

  private _buildQuery(
    routeConfigSegments: string[],
    values: { [key: string]: string; }
  ): { [key: string]: string; } {
    const params = routeConfigSegments.filter(s => s.startsWith(':'));
    return Object.fromEntries(
      Object.entries(values)
        .filter(([k]) => !params.some(p => p.includes(k)))
    );
  }
}
