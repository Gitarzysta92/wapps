import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ContentAttributionDto, ContentNature } from '@domains/publication/attribution';
import { AttributionInfoBadgeComponent, AttributionInfoVM, mapAttributionToVM } from '@portals/shared/features/attribution';

@Component({
  selector: 'feed-attribution',
  standalone: true,
  imports: [AttributionInfoBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './feed-attribution.component.scss',
  template: `
    <attribution-info-badge [attribution]="badge" [title]="title" />
  `,
})
export class FeedAttributionComponent {
  @Input({ required: true }) attribution!: AttributionInfoVM | ContentAttributionDto;
  @Input() title = 'this item';
  get badge(): AttributionInfoVM {
    return {
      ...mapAttributionToVM({ disclosureRequired: false, ...this.attribution }),
      displayText: this.label,
      tooltipText: this.details,
    };
  }
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
