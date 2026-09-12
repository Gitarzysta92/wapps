import { Component } from '@angular/core';
import { ResultsPageComponent } from '../results-page/results-page.component';

@Component({
  selector: 'tag-results-page',
  templateUrl: './tag-results-page.component.html',
  styleUrl: './tag-results-page.component.scss',
  standalone: true,
  imports: [ResultsPageComponent]
})
export class TagResultsPageComponent {}
