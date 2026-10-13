export type ContentClassification = 'general' | 'mature';

export interface ClassifiedContent {
  /** Missing means unclassified, including publications predating review of this field. */
  classification?: ContentClassification;
}

/** Omit absent fields so legacy immutable snapshots keep their original fingerprints. */
export function classificationFields(
  value: unknown,
  invalid: new (message: string) => Error = Error
): ClassifiedContent {
  if (value === undefined) return {};
  if (value !== 'general' && value !== 'mature')
    throw new invalid('Choose general or mature content classification');
  return { classification: value };
}

/** Call only with the classification of the currently approved publication. */
export function permitsContent(
  content: ClassifiedContent,
  showMatureContent: boolean
): boolean {
  return showMatureContent || content.classification === 'general';
}
