import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { FiltersBarComponent } from '../../partials/filters-bar/src';
import { TuiButton } from '@taiga-ui/core';
import { SearchResultsPageService } from './search-results-page.service';
import { 
  DiscoverySearchResultType, 
  DiscoverySearchResultApplicationItemDto,
  DiscoverySearchResultArticleItemDto,
  DiscoverySearchResultSuiteItemDto 
} from '@domains/discovery';

@Component({
  selector: 'search-results-page',
  standalone: true,
  imports: [
    CommonModule,
    FiltersBarComponent,
    TuiButton,
  ],
  providers: [SearchResultsPageService],
  templateUrl: './search-results-page.component.html',
  styleUrl: './search-results-page.component.scss',
  hostDirectives: [
    RouteDrivenContainerDirective
  ],
  host: {
    'class': 'fluid-container'
  },
})
export class SearchResultsPageComponent {
  protected readonly paginationService = inject(SearchResultsPageService);
  protected readonly DiscoverySearchResultType = DiscoverySearchResultType;

  public onSortingChange(event: { sort: string }): void {
    console.log('Sorting changed:', event);
    // Handle sorting logic here
  }

  protected asApplication(
    entry: DiscoverySearchResultApplicationItemDto | DiscoverySearchResultArticleItemDto | DiscoverySearchResultSuiteItemDto
  ): DiscoverySearchResultApplicationItemDto {
    return entry as DiscoverySearchResultApplicationItemDto;
  }

  protected asArticle(
    entry: DiscoverySearchResultApplicationItemDto | DiscoverySearchResultArticleItemDto | DiscoverySearchResultSuiteItemDto
  ): DiscoverySearchResultArticleItemDto {
    return entry as DiscoverySearchResultArticleItemDto;
  }

  protected asSuite(
    entry: DiscoverySearchResultApplicationItemDto | DiscoverySearchResultArticleItemDto | DiscoverySearchResultSuiteItemDto
  ): DiscoverySearchResultSuiteItemDto {
    return entry as DiscoverySearchResultSuiteItemDto;
  }
}
