import { Component } from '@angular/core';
import { ResultsPageComponent } from '../results-page/results-page.component';

@Component({
  selector: 'search-results-page',
  standalone: true,
  imports: [ResultsPageComponent],
  templateUrl: './search-results-page.component.html',
  styleUrl: './search-results-page.component.scss'
})
export class SearchResultsPageComponent {}
