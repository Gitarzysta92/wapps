import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
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
    RouterLink,
    FullSearchRedirectComponent,
    SearchResultPreviewList,
    SearchResultListSkeleton,
  ],
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

