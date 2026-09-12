import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { DiscoverySearchService, normalizeSearch } from '@portals/shared/features/search';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'header',
  templateUrl: 'header.component.html',
  styleUrl: 'header.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TuiTextfield, TuiButton],
})
export class HeaderPartialComponent {
  private readonly router = inject(Router);
  private readonly searchService = inject(DiscoverySearchService);
  protected readonly search = new FormControl('', { nonNullable: true });

  // Retain the layout inputs/outputs while the parent owns header placement.
  @Input() showCollapseButton = false;
  @Output() expandedStateChange = new EventEmitter<boolean>();

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.search.setValue(params.get('search') ?? '', { emitEvent: false });
    });
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    const phrase = normalizeSearch(this.search.value);
    if (!phrase) return;
    this.searchService.remember(phrase);
    void this.router.navigate(['/' + NAVIGATION.discover.path], { queryParams: { search: phrase } });
  }
}
