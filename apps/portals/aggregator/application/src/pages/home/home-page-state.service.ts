import { inject, Injectable } from "@angular/core";
import { IMultiSearchState } from "@portals/shared/features/multi-search";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";
import { FILTERS } from "../../filters";


@Injectable()
export class HomePageStateService implements IMultiSearchState {

  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

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
  
  public setQueryParams(p: { [key: string]: string | null }): void {
    const value = p[FILTERS.search];
    if (typeof value === 'string') {
      if (!value || value.length <= 0) {
        this._router.navigate([], { queryParams: {} })
      } else {
        this._router.navigate([], { queryParams: { [FILTERS.search]: value } })
      }
    }
  }

}