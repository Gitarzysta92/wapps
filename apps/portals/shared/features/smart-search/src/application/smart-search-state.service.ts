import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ISmartSearchState } from '../smart-search.interface';

@Injectable()
export class SmartSearchStateService implements ISmartSearchState {
  public query: string = '';
  public results: any = null;
  public suggestions: string[] = [];
  public recommendations: any[] = [];
  public recentSearches: string[] = [];
  public isLoading: boolean = false;
  public error: string | null = null;

  private readonly _querySubject = new BehaviorSubject<string>('');
  public readonly queryParamMap$ = new BehaviorSubject<any>({});

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    // Initialize query from route params
    this.route.queryParams.subscribe(params => {
      this.query = params['q'] || '';
      this._querySubject.next(this.query);
      this.queryParamMap$.next(params);
    });
  }

  public setQueryParams(params: { [key: string]: any }): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge'
    });
  }

  public setQuery(query: string): void {
    this.query = query;
    this._querySubject.next(query);
  }

  public setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  public setResults(results: any): void {
    this.results = results;
  }

  public setSuggestions(suggestions: string[]): void {
    this.suggestions = suggestions;
  }

  public setRecommendations(recommendations: any[]): void {
    this.recommendations = recommendations;
  }

  public setError(error: string | null): void {
    this.error = error;
  }

  public setRecentSearches(recentSearches: string[]): void {
    this.recentSearches = recentSearches;
  }
}
