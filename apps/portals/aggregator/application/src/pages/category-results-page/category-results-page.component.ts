import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { CatalogDirectoryPageComponent } from '../catalog-directory-page/catalog-directory-page.component';
import { ResultsPageComponent } from '../results-page/results-page.component';

@Component({
  selector: 'category-results-page',
  templateUrl: './category-results-page.component.html',
  styleUrl: './category-results-page.component.scss',
  standalone: true,
  imports: [ResultsPageComponent, CatalogDirectoryPageComponent]
})
export class CategoryResultsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly isDirectory = computed(() => !this.params().get('categorySlug') && !this.params().get('category'));
}
