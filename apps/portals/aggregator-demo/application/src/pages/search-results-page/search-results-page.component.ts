import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { FiltersBarComponent } from '../../partials/filters-bar/src';
import { TuiButton } from '@taiga-ui/core';
import { SearchResultsPageService } from './search-results-page.service';

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

  public onSortingChange(event: { sort: string }): void {
    console.log('Sorting changed:', event);
    // Handle sorting logic here
  }
}
