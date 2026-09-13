import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { CatalogDirectoryPageComponent } from '../catalog-directory-page/catalog-directory-page.component';
import { ResultsPageComponent } from '../results-page/results-page.component';

@Component({
  selector: 'tag-results-page',
  templateUrl: './tag-results-page.component.html',
  styleUrl: './tag-results-page.component.scss',
  standalone: true,
  imports: [ResultsPageComponent, CatalogDirectoryPageComponent]
})
export class TagResultsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly isDirectory = computed(() => !this.params().get('tagSlug') && !this.params().get('tag'));
}
