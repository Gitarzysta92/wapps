import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { searchDiscoveryCatalog, updateRecentSearches } from './discovery-search';

@Injectable({ providedIn: 'root' })
export class DiscoverySearchService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'aggregator.recent-searches';
  private readonly recent = new BehaviorSubject<string[]>(this.readRecent());
  readonly recentSearches$ = this.recent.asObservable();

  search(params: Record<string, string>) {
    return searchDiscoveryCatalog(params);
  }

  remember(phrase: string): void {
    const recent = updateRecentSearches(this.recent.value, phrase);
    this.recent.next(recent);
    try {
      this.document.defaultView?.localStorage.setItem(this.storageKey, JSON.stringify(recent));
    } catch { /* Keep session history available when storage is disabled. */ }
  }

  private readRecent(): string[] {
    try {
      const saved: unknown = JSON.parse(this.document.defaultView?.localStorage.getItem(this.storageKey) ?? '[]');
      return Array.isArray(saved)
        ? saved.filter((value): value is string => typeof value === 'string' && !!value.trim()).slice(0, 10)
        : [];
    } catch { return []; }
  }
}
