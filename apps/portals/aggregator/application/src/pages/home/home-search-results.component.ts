import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { TuiButton } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge } from '@taiga-ui/kit';
import {
  FullSearchRedirectComponent,
  SearchResultListSkeleton,
  SearchResultVM
} from '@ui/search-results';

@Component({
  selector: 'home-search-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FullSearchRedirectComponent,
    TuiButton,
    SearchResultListSkeleton,
    TuiBadge,
    TuiAvatar,
  ],
  styles: [`
    ul { list-style: none; padding: 0; margin: 0; }
    .group-header, .result-entry {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.5rem 1.25rem; border-radius: var(--tui-radius-m);
    }
    .group-name { flex: 1; padding-left: 0.5rem; }
    .result-entry { font-size: 0.875rem; }
    .result-entries { padding-bottom: 0.5rem; }
    .entry-info { min-width: 0; overflow-wrap: anywhere; }

    .custom-content {
      display: flex;  
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
      flex: 1;
      tui-badge{
       padding: 0 6px;
      }

      .entry-name {
        padding: 0 6px;
      }
    }
    
    .tags {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
    }
    
  `],
  template: `
    @if (searchResults$ | async; as searchResult) {
      @if (loadingResults) {
        <ul search-result-list-skeleton></ul>
      }
      @else if (searchResult.groups && searchResult.groups.length > 0) {
        <a class="full-search-redirect"
          [full-search-redirect]="searchResult.itemsNumber"
          [routerLink]="searchResult.link"
          [queryParams]="searchResult.query">
        </a>
        <ul class="preview-list" 
          >
          @for (group of searchResult.groups; track group.id) {
            <li>
              <a class="group-header" tuiButton size="s" appearance="flat"
                [iconStart]="group.icon" iconEnd="@tui.chevron-right"
                [routerLink]="searchResult.link"
                [queryParams]="groupQuery(searchResult.query, group.type)">
                <span class="group-name">{{ group.name }}</span><span>View all</span>
              </a>
              <ul class="result-entries">
              @for (entry of group.entries; track entry.link) {
                <li><a class="result-entry" tuiButton size="s" appearance="flat"
                  [routerLink]="entry.link" iconEnd="@tui.chevron-right">
            <div class="custom-content">
              <tui-avatar size="s" [src]="entry.coverImageUrl.url" />
              <div class="entry-info">
                <div class="entry-name">
                  {{ entry.name }}
                </div>
                @if (entry.tags && entry.tags.length > 0) {
                  <div class="tags">
                    @for (tag of entry.tags.slice(0, 3); track tag.name) {
                      <tui-badge 
                        size="s"
                        appearance="neutral">
                        {{ tag.name | lowercase }}
                      </tui-badge>
                    }
                  </div>
                }
              </div>
            </div>
                </a></li>
              }
              </ul>
            </li>
          }
        </ul>
      }
      @else {
        <p class="no-results">No results</p>
      }
    }
  `
})
export class HomeSearchResultsComponent {
  protected groupQuery(query: Record<string, string>, type: string): Record<string, string> {
    return { ...query, type: type.toLowerCase() };
  }

  @Input({ required: true }) searchResults$!: Observable<SearchResultVM>;
  @Input({ required: true }) loadingResults!: boolean;
}
