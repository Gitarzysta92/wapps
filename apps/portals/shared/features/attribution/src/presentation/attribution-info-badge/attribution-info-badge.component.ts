import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TuiButton, TuiDropdown } from '@taiga-ui/core';
import { AttributionType, ContentNature, VerificationLevel } from '@domains/publication/attribution';

export const ATTRIBUTION_INFO_BADGE_SELECTOR = 'attribution-info-badge';

export type AttributionInfoVM = {
  attributionType: AttributionType;
  contentNature: ContentNature;
  verificationLevel?: VerificationLevel;
  sponsor?: string;
  displayText: string;
  icon: string;
  tooltipText: string;
  badgeAppearance: 'primary' | 'accent' | 'neutral' | 'warning' | 'error';
};

@Component({
  selector: ATTRIBUTION_INFO_BADGE_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiButton,
    TuiDropdown,
  ],
  templateUrl: './attribution-info-badge.component.html',
  styleUrls: ['./attribution-info-badge.component.scss']
})
export class AttributionInfoBadgeComponent {
  @Input({ required: true }) attribution!: AttributionInfoVM;
  @Input() title = 'this item';
  open = false;
}
