import { Component, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { FiltersBarComponent } from '../../partials/filters-bar/src';
import { TuiButton } from '@taiga-ui/core';
import { TuiSkeleton } from '@taiga-ui/kit';
import { SearchResultsPageService } from './search-results-page.service';
import { SearchResultsPageStateService } from './search-results-page-state.service';
import { 
  DiscoverySearchResultType, 
  DiscoverySearchResultApplicationItemDto,
  DiscoverySearchResultArticleItemDto,
  DiscoverySearchResultSuiteItemDto, 
  DiscoverySearchResultGroupDto
} from '@domains/discovery';
import { delay, map, of, startWith } from 'rxjs';
import { DISCOVERY_SEARCH_RESULTS_DATA } from '@portals/shared/data';
import { IntersectDirective } from '@ui/misc';
import { GlobalStateService } from '../../state/global-state.service';

@Component({
  selector: 'search-results-page',
  standalone: true,
  imports: [
    CommonModule,
    FiltersBarComponent,
    TuiButton,
    TuiSkeleton,
    IntersectDirective
  ],
  providers: [
    SearchResultsPageService
  ],
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

  private readonly _stateService = inject(GlobalStateService);

  protected readonly resultsData$ = of(DISCOVERY_SEARCH_RESULTS_DATA)
    .pipe(
      delay(4000),
      map(d => Object.assign({}, d, { isLoading: false })),
      startWith({ itemsNumber: 0, groups: [], link: "", query: {}, isLoading: true }));
  


  public onVisibilityChange(
    isVisible: boolean,
    element: Element,
    group: DiscoverySearchResultGroupDto
  ): void {
    if (isVisible) {
      this._stateService.activeSection$.next(group.type);
    }
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
