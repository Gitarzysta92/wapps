import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { FiltersBarComponent } from '../../partials/filters-bar/src';
import { SortingSelectComponent } from '../../partials/sorting-select/sorting-select.component';
import { TuiButton } from '@taiga-ui/core';

interface SearchResultItem {
  id: number;
  name: string;
  description: string;
  category: string;
  rating: string;
}

interface PageData {
  pageNumber: number;
  items: SearchResultItem[];
}

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
  // Track loaded pages with their items
  public loadedPages = new Map<number, SearchResultItem[]>();
  public firstLoadedPage = 1;
  public lastLoadedPage = 1;
  public totalPages = 5;
  public itemsPerPage = 6;

  constructor() {
    // Load initial page
    this.loadPage(1);
  }

  // Get all items from loaded pages in order
  public get allLoadedItems(): PageData[] {
    const pages: PageData[] = [];
    for (let i = this.firstLoadedPage; i <= this.lastLoadedPage; i++) {
      const items = this.loadedPages.get(i);
      if (items) {
        pages.push({ pageNumber: i, items });
      }
    }
    return pages;
  }

  public get canLoadPrevious(): boolean {
    return this.firstLoadedPage > 1;
  }

  public get canLoadNext(): boolean {
    return this.lastLoadedPage < this.totalPages;
  }

  public get totalLoadedItems(): number {
    let count = 0;
    this.loadedPages.forEach(items => count += items.length);
    return count;
  }

  public loadPreviousPage(): void {
    if (this.canLoadPrevious) {
      const pageToLoad = this.firstLoadedPage - 1;
      this.loadPage(pageToLoad);
      this.firstLoadedPage = pageToLoad;
    }
  }

  public loadNextPage(): void {
    if (this.canLoadNext) {
      const pageToLoad = this.lastLoadedPage + 1;
      this.loadPage(pageToLoad);
      this.lastLoadedPage = pageToLoad;
    }
  }

  private loadPage(pageNumber: number): void {
    // Mock API call - generate items for this page
    const items = this.generateMockItems(pageNumber, this.itemsPerPage);
    this.loadedPages.set(pageNumber, items);
  }

  private generateMockItems(page: number, count: number): SearchResultItem[] {
    const startId = (page - 1) * count + 1;
    const categories = ['Productivity', 'Entertainment', 'Education', 'Social', 'Graphics', 'Business', 'Tools', 'Games'];
    const items: SearchResultItem[] = [];

    for (let i = 0; i < count; i++) {
      const id = startId + i;
      items.push({
        id,
        name: `Sample App ${id}`,
        description: `Description for application ${id}`,
        category: categories[id % categories.length],
        rating: (3.5 + Math.random() * 1.5).toFixed(1),
      });
    }

    return items;
  }

  public onSortingChange(event: { sort: string }): void {
    console.log('Sorting changed:', event);
    // Handle sorting logic here
  }
}
