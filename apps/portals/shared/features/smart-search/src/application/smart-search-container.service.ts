import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SmartSearchContainerService {
  private readonly _isVisibleSubject = new BehaviorSubject<boolean>(false);
  private readonly _suggestionsSubject = new BehaviorSubject<string[]>([]);
  private readonly _querySubject = new BehaviorSubject<string>('');

  public readonly isVisible$ = this._isVisibleSubject.asObservable();
  public readonly suggestions$ = this._suggestionsSubject.asObservable();
  public readonly query$ = this._querySubject.asObservable();

  public setVisibility(visible: boolean): void {
    this._isVisibleSubject.next(visible);
  }

  public setSuggestions(suggestions: string[]): void {
    this._suggestionsSubject.next(suggestions);
  }

  public setQuery(query: string): void {
    this._querySubject.next(query);
  }

  public getCurrentSuggestions(): string[] {
    return this._suggestionsSubject.value;
  }

  public getCurrentQuery(): string {
    return this._querySubject.value;
  }

  public isCurrentlyVisible(): boolean {
    return this._isVisibleSubject.value;
  }
}
