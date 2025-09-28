import { Component, inject, Injector, OnInit } from '@angular/core';
import { FILTERS } from '../../filters';
import { ActivatedRoute, Router, UrlSegment } from '@angular/router';
import { FiltersBarComponent } from '../../partials/filters-bar/filters-bar.component';
import { TuiDialogService } from '@taiga-ui/core';
import { combineLatest, filter, map, startWith, Subject } from 'rxjs';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { FiltersDialogComponent } from '../../dialogs/filters-dialog/filters-dialog.component';
import { SortingSelectComponent } from '../../partials/sorting-select/sorting-select.component';
import { AppListingComponent } from '../../partials/app-listing/app-listing.component';


@Component({
  selector: 'main',
  templateUrl: './category-results-page.component.html',
  styleUrl: './category-results-page.component.scss',
  host: {
    'class': 'fluid-container'
  },
  imports: [
    FiltersBarComponent,
    SortingSelectComponent,
    AppListingComponent
  ]
})
export class CategoryResultsPageComponent implements OnInit {

  private readonly _injector = inject(Injector);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _dialogService = inject(TuiDialogService);
  public readonly filterKey = FILTERS;
  
  public readonly filterParams = new Subject<{ [key: string]: string[]; }>();
  public readonly listingParams = new Subject<{ page: string; }>();
  public readonly sortingParam = new Subject<{ sort: string; }>();


  public ngOnInit(): void {
    this._handleNavigationOnRouteChange();
  }

  public openDialog(): void {
    this._dialogService.open(
      new PolymorpheusComponent(FiltersDialogComponent, this._injector),
      { data: { filterParams : this.filterParams } }
    ).subscribe()
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
        const queryParams = this._buildQuery(config, { ...filters, ...listing, ...sorting })
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
      return routeSegments[i].path
    })
  }

  private _buildQuery(
    routeConfigSegments: string[],
    values: { [key: string]: string; }
  ): { [key: string]: string; } {
    const params = routeConfigSegments.filter(s => s.startsWith(':'));
    return Object.fromEntries(
      Object.entries(values)
        .filter(([k]) => !params.some(p => p.includes(k))))
  }

}