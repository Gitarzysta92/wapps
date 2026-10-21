import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CatalogBrowserService } from '@portals/shared/features/listing';
import { DiscoverApiPageComponent } from './discover-api-page.component';
import { DemoDiscoverPageComponent } from './demo-discover-page.component';

@Component({
  selector: 'discover-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DiscoverApiPageComponent, DemoDiscoverPageComponent],
  template: `@if (mode === 'api') { <discover-api-page /> } @else {
    <demo-discover-page /> }`,
  styleUrl: './discover-page.component.scss',
})
export class DiscoverPageComponent {
  readonly mode = inject(CatalogBrowserService).mode;
}
