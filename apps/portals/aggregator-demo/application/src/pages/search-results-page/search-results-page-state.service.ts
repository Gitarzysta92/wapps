import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DiscoverySearchResultDto } from '@domains/discovery';

export interface SearchResultsData extends DiscoverySearchResultDto {
  isLoading: boolean;
}

@Injectable()
export class SearchResultsPageStateService {
  public readonly activeSection = signal<string | null>(null);
  
  public readonly resultsData$ = new BehaviorSubject<SearchResultsData>({
    itemsNumber: 0,
    groups: [],
    query: {},
    isLoading: true
  });
  
  public setResultsData(data: SearchResultsData): void {
    this.resultsData$.next(data);
  }
}

