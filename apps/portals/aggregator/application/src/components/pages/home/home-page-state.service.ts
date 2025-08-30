import { inject, Injectable } from "@angular/core";
import { IMultiSearchState } from "@ui/multi-search";
import { ActivatedRoute, Router } from "@angular/router";
import { GlobalStateService } from "../../../state/global-state.service";


@Injectable()
export class HomePageStateService implements IMultiSearchState {

  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _globalState = inject(GlobalStateService);

  public queryParamMap$ = this._route.queryParamMap;
  
  public setQueryParams(p: { [key: symbol]: string; }): void {
    if ('phrase' in p && typeof p.phrase === 'string') {
      if (!p.phrase || p.phrase.length <= 0) {
        this._router.navigate([], { queryParams: {}})
      } else {
        this._router.navigate([], { queryParams: { pharse: p.phrase }})
      }
    }
  }

}