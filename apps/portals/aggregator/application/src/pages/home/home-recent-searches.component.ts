import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { MultiSearchRecentSearchesVM } from '@portals/shared/features/multi-search';

@Component({
  selector: 'home-recent-searches',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink, TuiButton, TuiIcon,
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

    .search-name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .no-results {
      padding: 1rem;
      text-align: center;
    }
  `],
  template: `
    @if (recentSearches$ | async; as recentSearches) {
      @if (recentSearches.searches && recentSearches.searches.length > 0) {
        <div class="recent-searches-container">
          <div class="recent-heading"><tui-icon icon="@tui.history"/> Recent</div>
          <ul>
            @for (search of recentSearches.searches; track search.name) {
              <li><a tuiButton size="s" appearance="flat" class="recent-search-item"
                [routerLink]="search.link" [queryParams]="search.query"
                iconStart="@tui.search" iconEnd="@tui.chevron-right"><span class="search-name">{{ search.name }}</span></a></li>
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
