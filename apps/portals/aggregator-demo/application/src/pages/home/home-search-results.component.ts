import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { TuiAvatar, TuiBadge } from '@taiga-ui/kit';
import {
  FullSearchRedirectComponent,
  SearchResultPreviewList,
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
    SearchResultPreviewList,
    SearchResultListSkeleton,
    TuiBadge,
    TuiAvatar,
  ],
  styles: [`
    .custom-content {
      display: flex;  
      align-items: center;
      gap: 0.5rem;
      tui-badge{
       padding: 0 6px;
       color: #9f9f9f;
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
    
    .author {
      font-size: 0.875rem;
      color: var(--tui-text-secondary);
    }
    
    .rating-wrapper {
      display: flex;
      align-items: center;
      gap: 0.25rem;
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
          [search-result-preview-list]="searchResult.groups">
          <ng-template #customContent let-entry>
            <div class="custom-content">
              <tui-avatar size="s" [src]="entry.coverImageUrl" />
              <div class="entry-info">
                <div class="entry-name">
                  {{ entry.name }}
                </div>
                @if (entry.tags && entry.tags.length > 0) {
                  <div class="tags">
                    @for (tag of entry.tags.slice(0, 3); track tag.id) {
                      <tui-badge 
                        size="s"
                        appearance="secondary">
                        {{ tag.name | lowercase }}
                      </tui-badge>
                    }
                  </div>
                }
              </div>
            </div>
          </ng-template>
        </ul>
      }
      @else {
        <p>No results</p>
      }
    }
  `
})
export class HomeSearchResultsComponent {
  @Input({ required: true }) searchResults$!: Observable<SearchResultVM>;
  @Input({ required: true }) loadingResults!: boolean;
}

