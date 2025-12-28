export enum AttributionType {
  AI_GENERATED = 'ai-generated',
  HUMAN_CREATED = 'human-created',
  HYBRID = 'hybrid',
  UNKNOWN = 'unknown'
}

export enum ContentNature {
  ORGANIC = 'organic',
  SPONSORED = 'sponsored',
  ADVERTISEMENT = 'advertisement',
  PROMOTED = 'promoted',
  EDITORIAL = 'editorial'
}

export enum VerificationLevel {
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
  DISPUTED = 'disputed'
}

export type ContentAttributionDto = {
  attributionType: AttributionType;
  contentNature: ContentNature;
  verificationLevel?: VerificationLevel;
  sponsor?: string;
  generatedBy?: string;
  disclosureRequired: boolean;
  metadata?: Record<string, unknown>;
};
