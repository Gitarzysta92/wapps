import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TuiBadge } from '@taiga-ui/kit';
import { ContentAttributionDto, ContentNature } from '@domains/publication/attribution';
import { AttributionInfoVM, mapAttributionToVM } from '@portals/shared/features/attribution';

@Component({
  selector: 'feed-attribution',
  standalone: true,
  imports: [TuiBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './feed-actions.scss',
  template: `
    <details>
      <summary [attr.aria-label]="'Content attribution for ' + title">
        Content attribution <tui-badge size="s">{{ label }}</tui-badge>
      </summary>
      <p>{{ details }}</p>
    </details>
  `,
})
export class FeedAttributionComponent {
  @Input({ required: true }) attribution!: AttributionInfoVM | ContentAttributionDto;
  @Input() title = 'this item';
  get label(): string {
    switch (this.attribution.contentNature) {
      case ContentNature.SPONSORED: return this.attribution.sponsor ? `Sponsored by ${this.attribution.sponsor}` : 'Sponsored';
      case ContentNature.ADVERTISEMENT: return 'Advertisement';
      case ContentNature.PROMOTED: return 'Promoted';
      case ContentNature.EDITORIAL: return 'Editorial';
      default: return 'Source details';
    }
  }
  get details(): string {
    return ('tooltipText' in this.attribution && this.attribution.tooltipText) ||
      mapAttributionToVM({ disclosureRequired: false, ...this.attribution }).tooltipText || 'No further attribution details are available.';
  }
}
