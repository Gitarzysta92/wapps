import { inject, Injectable } from "@angular/core";
import { IMultiSearchState } from "@portals/shared/features/multi-search";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";
import { DiscoverySearchService } from '@portals/shared/features/search';
import { NAVIGATION } from '../../navigation';
import { FILTERS } from "../../filters";


@Injectable()
export class HomePageStateService implements IMultiSearchState {

  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  // TODO: this has to be simplified
  public queryParamMap$ = this._route.queryParamMap.pipe(
    map(p => {
      const entries: [string, string][] = [];
      p.keys.forEach(key => {
        const value = p.get(key);
        if (value !== null) {
          entries.push([key, value]);
        }
      });
      return Object.fromEntries(entries);
    })
  );
  
  private readonly searchService = inject(DiscoverySearchService);

  public setQueryParams(p: Record<string, string | null>): void {
    if (FILTERS.search in p) {
      void this._router.navigate([], {
        relativeTo: this._route,
        queryParams: { search: p[FILTERS.search]?.trim() || null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  public submitSearch(search: string): void {
    const phrase = search.trim();
    if (!phrase) return;
    this.searchService.remember(phrase);
    void this._router.navigate(['/' + NAVIGATION.discover.path], { queryParams: { search: phrase } });
  }
}
