import { Component } from '@angular/core';
import { ResultsPageComponent } from '../results-page/results-page.component';

@Component({
  selector: 'applications-page',
  templateUrl: './applications.component.html',
  styleUrl: './applications.component.scss',
  standalone: true,
  imports: [ResultsPageComponent]
})
export class ApplicationsPageComponent {}
