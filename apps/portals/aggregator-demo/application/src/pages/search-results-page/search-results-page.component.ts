import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { FiltersBarComponent } from '../../partials/filters-bar/src';
import { SortingSelectComponent } from '../../partials/sorting-select/sorting-select.component';
import { TuiButton } from '@taiga-ui/core';

@Component({
  selector: 'search-results-page',
  standalone: true,
  imports: [
    CommonModule,
    FiltersBarComponent,
    SortingSelectComponent,
    TuiButton,
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
  // Mock data for display
  public items = [
    { id: 1, name: 'Sample App 1', description: 'A great application for productivity', category: 'Productivity', rating: 4.5 },
    { id: 2, name: 'Sample App 2', description: 'Entertainment application', category: 'Entertainment', rating: 4.2 },
    { id: 3, name: 'Sample App 3', description: 'Educational tool', category: 'Education', rating: 4.8 },
    { id: 4, name: 'Sample App 4', description: 'Social networking platform', category: 'Social', rating: 4.0 },
    { id: 5, name: 'Sample App 5', description: 'Photo editing software', category: 'Graphics', rating: 4.6 },
    { id: 6, name: 'Sample App 6', description: 'Video streaming service', category: 'Entertainment', rating: 4.3 },
  ];

  public currentPage = 1;
  public totalPages = 5;

  public onSortingChange(event: { sort: string }): void {
    console.log('Sorting changed:', event);
    // Handle sorting logic here
  }
}
