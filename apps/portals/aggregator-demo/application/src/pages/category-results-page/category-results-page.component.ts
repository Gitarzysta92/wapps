import { Component } from '@angular/core';
import { ResultsPageComponent } from '../results-page/results-page.component';

@Component({
  selector: 'category-results-page',
  templateUrl: './category-results-page.component.html',
  styleUrl: './category-results-page.component.scss',
  standalone: true,
  imports: [ResultsPageComponent]
})
export class CategoryResultsPageComponent {}
