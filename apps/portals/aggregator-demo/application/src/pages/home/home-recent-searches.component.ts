import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { RecentSearchesList } from '@ui/search-results';
import { MultiSearchRecentSearchesVM } from '@portals/shared/features/multi-search';
import { TuiBadge } from '@taiga-ui/kit';

@Component({
  selector: 'home-recent-searches',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RecentSearchesList,
    TuiBadge,
  ],
  styles: [`
    .recent-searches-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .recent-searches-header {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0;
      color: var(--tui-text-primary);
    }

    .custom-search-content {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }

    .search-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }

    .search-name {
      font-weight: 500;
      color: var(--tui-text-primary);
    }

    .search-meta {
      font-size: 0.75rem;
      color: var(--tui-text-secondary);
    }

    .no-results {
      padding: 1rem;
      text-align: center;
      color: var(--tui-text-secondary);
    }
  `],
  template: `
    @if (recentSearches$ | async; as recentSearches) {
      @if (recentSearches.searches && recentSearches.searches.length > 0) {
        <div class="recent-searches-container">
          <ul [recent-searches-list]="recentSearches.searches">
            <ng-template #customContent let-search>
              <div class="custom-search-content">
                <div class="search-info">
                  <span class="search-name">{{ search.name }}</span>
                </div>
              </div>
            </ng-template>
          </ul>
        </div>
      } @else {
        <p class="no-results">No recent searches</p>
      }
    }
  `
})
export class HomeRecentSearchesComponent {
  @Input({ required: true }) recentSearches$!: Observable<MultiSearchRecentSearchesVM | null>;
}

