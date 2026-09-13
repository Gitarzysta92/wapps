import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IMultiSearchState } from "@portals/shared/features/multi-search";
import { ActivatedRoute, Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { DiscoverySearchService } from '@portals/shared/features/search';
import { NAVIGATION } from '../../navigation';
import { FILTERS } from "../../filters";


@Injectable()
export class HomePageStateService implements IMultiSearchState {

  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  private readonly draft = new BehaviorSubject<Record<string, string>>({});
  public readonly queryParamMap$ = this.draft.asObservable();

  constructor() {
    this._route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.draft.next(Object.fromEntries(params.keys.map(key => [key, params.get(key)!])));
    });
  }
  
  private readonly searchService = inject(DiscoverySearchService);

  public setQueryParams(p: Record<string, string | null>): void {
    if (FILTERS.search in p) {
      // Suggestions are local drafts; navigating on each keystroke resets page scroll.
      this.draft.next({ ...this.draft.value, [FILTERS.search]: p[FILTERS.search]?.trim() || '' });
    }
  }

  public submitSearch(search: string): void {
    const phrase = search.trim();
    if (!phrase) return;
    this.searchService.remember(phrase);
    void this._router.navigate(['/' + NAVIGATION.discover.path], { queryParams: { search: phrase } });
  }
}
