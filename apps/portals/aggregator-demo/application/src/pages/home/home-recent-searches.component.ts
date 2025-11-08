import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { RecentSearchesList } from '@ui/search-results';
import { MultiSearchRecentSearchesVM } from '@portals/shared/features/multi-search';

@Component({
  selector: 'home-recent-searches',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RecentSearchesList,
  ],
  template: `
    @if (recentSearches$ | async; as recentSearches) {
      @if (recentSearches.searches && recentSearches.searches.length > 0) {
        <div class="recent-searches">
          <h4>Recent searches:</h4>
          <ul [recent-searches-list]="recentSearches.searches"></ul>
        </div>
      } @else {
        <p>No recent searches</p>
      }
    }
  `
})
export class HomeRecentSearchesComponent {
  @Input({ required: true }) recentSearches$!: Observable<MultiSearchRecentSearchesVM | null>;
}

