import { Injectable, signal } from '@angular/core';

@Injectable()
export class SearchResultsPageStateService {
  public readonly activeSection = signal<string | null>(null);
}

