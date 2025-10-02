import { Component } from '@angular/core';
import { ResultsPageComponent } from '../results-page/results-page.component';

@Component({
  selector: 'articles-page',
  templateUrl: './articles.component.html',
  styleUrl: './articles.component.scss',
  standalone: true,
  imports: [ResultsPageComponent]
})
export class ArticlesPageComponent {}
