import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';
import { TuiLink, TuiIcon } from '@taiga-ui/core';
import { MultiSearchRecentSearchesVM } from '@portals/shared/features/multi-search';

@Component({
  selector: 'home-recent-searches',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink, TuiLink, TuiIcon,
  ],
  styles: [`
    ul { list-style: none; padding: 0; margin: 0; }
    .recent-heading, .recent-search-item {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem;
      border-radius: var(--tui-radius-m); font-size: 0.875rem;
    }

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
          <div class="recent-heading"><tui-icon icon="@tui.history"/> Recent</div>
          <ul>
            @for (search of recentSearches.searches; track search.name) {
              <li><a tuiLink appearance="action-soft" class="recent-search-item"
                [routerLink]="search.link" [queryParams]="search.query"
                iconStart="@tui.search" iconEnd="@tui.chevron-right">{{ search.name }}</a></li>
            }
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

