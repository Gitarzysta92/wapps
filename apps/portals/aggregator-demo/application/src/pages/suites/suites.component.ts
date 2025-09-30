import { Component } from '@angular/core';
import { ResultsPageComponent } from '../results-page/results-page.component';

@Component({
  selector: 'suites-page',
  templateUrl: './suites.component.html',
  styleUrl: './suites.component.scss',
  standalone: true,
  imports: [ResultsPageComponent]
})
export class SuitesPageComponent {}
