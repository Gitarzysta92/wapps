export const IDENTITY_KIND = 'identity';
export const SUBJECT_TO_IDENTITY_RELATION = 'represents';

/**
 * External identity provider key (e.g. "firebase", "google", "github").
 * This is *not* a graph node kind; subjects are stored separately (e.g. `identity_subjects` table/collection).
 */
export type IdentityProvider = string;

/**
 * Stable, deterministic subject id (works as PK for MySQL or `_id`/`id` in Mongo):
 * `${provider}:${externalId}` (e.g. `firebase:abc123`).
 */
export function identitySubjectId(provider: IdentityProvider, externalId: string): string {
  return `${provider}:${externalId}`;
}

