import { inject, Injectable } from "@angular/core";
import { IMultiSearchState } from "@portals/shared/features/multi-search";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";
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
  
  public setQueryParams(p: { [key: symbol]: string; }): void {
    console.log(p);
    if (FILTERS.search in p && typeof p.search === 'string') {
      if (!p.search || p.search.length <= 0) {
        this._router.navigate([], { queryParams: {}})
      } else {
        this._router.navigate([], { queryParams: { [FILTERS.search]: p.search }})
      }
    }
  }

}