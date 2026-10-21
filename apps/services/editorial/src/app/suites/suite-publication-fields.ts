import {
  parseSuiteFields,
  SuiteUnavailableError,
} from '@domains/publication/suite';

/** Public authority contains only the approved fields, independent of private review history. */
export function suitePublicationFields(row: Record<string, unknown>) {
  try {
    return parseSuiteFields({
      title: row.title,
      description: row.description,
      classification: row.classification ?? undefined,
      applicationIds:
        typeof row.applicationIds === 'string'
          ? JSON.parse(row.applicationIds)
          : row.applicationIds,
    });
  } catch {
    throw new SuiteUnavailableError(
      'Stored suite publication content is invalid'
    );
  }
}
