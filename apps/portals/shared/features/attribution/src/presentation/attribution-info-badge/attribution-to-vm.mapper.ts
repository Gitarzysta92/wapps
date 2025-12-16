import { AttributionType, ContentNature, ContentAttributionDto, VerificationLevel } from '@domains/publication/attribution';
import { AttributionInfoVM } from './attribution-info-badge.component';

export function mapAttributionToVM(attribution: ContentAttributionDto): AttributionInfoVM {
  return {
    attributionType: attribution.attributionType,
    contentNature: attribution.contentNature,
    verificationLevel: attribution.verificationLevel,
    sponsor: attribution.sponsor,
    displayText: '', // Not displayed on badge anymore
    icon: getIcon(attribution),
    tooltipText: getTooltipText(attribution),
    badgeAppearance: getBadgeAppearance(attribution)
  };
}

function getDisplayText(attribution: ContentAttributionDto): string {
  switch (attribution.contentNature) {
    case ContentNature.SPONSORED:
      return attribution.sponsor ? `Sponsored by ${attribution.sponsor}` : 'Sponsored';
    case ContentNature.ADVERTISEMENT:
      return 'Advertisement';
    case ContentNature.PROMOTED:
      return 'Promoted';
    case ContentNature.EDITORIAL:
      return 'Editorial';
    case ContentNature.ORGANIC:
    default:
      return getAttributionTypeText(attribution.attributionType);
  }
}

function getAttributionTypeText(type: AttributionType): string {
  switch (type) {
    case AttributionType.AI_GENERATED:
      return 'AI Generated';
    case AttributionType.HYBRID:
      return 'Human + AI';
    case AttributionType.HUMAN_CREATED:
      return 'Human Created';
    case AttributionType.UNKNOWN:
    default:
      return '';
  }
}

function getIcon(attribution: ContentAttributionDto): string {
  // Content nature takes precedence
  switch (attribution.contentNature) {
    case ContentNature.SPONSORED:
    case ContentNature.ADVERTISEMENT:
      return '@tui.circle-dollar-sign';
    case ContentNature.PROMOTED:
      return '@tui.trending-up';
    case ContentNature.EDITORIAL:
      return '@tui.edit';
    case ContentNature.ORGANIC:
    default:
      return getAttributionTypeIcon(attribution.attributionType);
  }
}

function getAttributionTypeIcon(type: AttributionType): string {
  switch (type) {
    case AttributionType.AI_GENERATED:
      return '@tui.cpu';
    case AttributionType.HYBRID:
      return '@tui.users';
    case AttributionType.HUMAN_CREATED:
      return '@tui.user';
    case AttributionType.UNKNOWN:
    default:
      return '@tui.help-circle';
  }
}

function getTooltipText(attribution: ContentAttributionDto): string {
  const parts: string[] = [];
  
  // Add content nature info
  if (attribution.contentNature !== ContentNature.ORGANIC) {
    parts.push(`This content is ${attribution.contentNature.toLowerCase()}.`);
  }
  
  // Add attribution type info
  if (attribution.attributionType !== AttributionType.UNKNOWN) {
    parts.push(`Created by: ${getAttributionTypeText(attribution.attributionType)}`);
  }
  
  // Add verification info
  if (attribution.verificationLevel) {
    parts.push(`Verification: ${attribution.verificationLevel}`);
  }
  
  // Add generator info
  if (attribution.generatedBy) {
    parts.push(`Generator: ${attribution.generatedBy}`);
  }
  
  return parts.length > 0 ? parts.join(' ') : 'Content information';
}

function getBadgeAppearance(attribution: ContentAttributionDto): AttributionInfoVM['badgeAppearance'] {
  switch (attribution.contentNature) {
    case ContentNature.SPONSORED:
    case ContentNature.ADVERTISEMENT:
      return 'warning';
    case ContentNature.PROMOTED:
      return 'accent';
    case ContentNature.EDITORIAL:
      return 'primary';
    case ContentNature.ORGANIC:
    default:
      return getAttributionTypeAppearance(attribution.attributionType);
  }
}

function getAttributionTypeAppearance(type: AttributionType): AttributionInfoVM['badgeAppearance'] {
  switch (type) {
    case AttributionType.AI_GENERATED:
      return 'accent';
    case AttributionType.HYBRID:
      return 'primary';
    case AttributionType.HUMAN_CREATED:
      return 'neutral';
    case AttributionType.UNKNOWN:
    default:
      return 'neutral';
  }
}
