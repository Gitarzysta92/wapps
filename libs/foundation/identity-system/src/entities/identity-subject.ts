import { Uuidv7 } from '@foundation/standard';

/**
 * External identity subject (account) bound to an internal identity.
 *
 * This is not part of the identity graph itself; it's the mapping layer between
 * an authentication subject and an internal `identityId`.
 *
 * A "subject" can be:
 * - a third-party provider account (e.g. `provider="google"`, `externalId=<oidc sub>`)
 * - a first-party login identifier (e.g. `provider="email"`, `externalId=<normalized email>`)
 *
 * `id` is intentionally stable/deterministic (e.g. `firebase:<uid>` or `google:<sub>`)
 * so it can be used as a natural key and makes idempotent provisioning easy.
 */
export interface IIdentitySubject {
  id: string;
  provider: string;
  externalId: string;
  identityId: Uuidv7;

  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}

