import { Uuidv7 } from '@sdk/kernel/standard';

export type IdentityProviderSecret = string;
export type IdentityProviderType = string;

/**
 * External identity subject (account) bound to an internal identity.
 *
 * This is not part of the identity graph itself; it's the mapping layer between
 * an authentication subject and an internal `identityId`.
 *
 * A "subject" can be:
 * - a third-party provider account (e.g. `provider="google"`, `claim=<oidc sub>`)
 * - a first-party login identifier (e.g. `provider="email"`, `claim=<normalized email>`)
 *
 * `id` is intentionally stable/deterministic (e.g. `firebase:<uid>` or `google:<sub>`)
 * so it can be used as a natural key and makes idempotent provisioning easy.
 * 
 * ProviderSecret can be Token or Username:Password
 */
export interface IIdentitySubject {
  id: string;
  identityId: Uuidv7;

  providerType: IdentityProviderType;
  /**
   * Provider-specific stable identifier for the subject (e.g. OIDC subject claim).
   * Examples: Firebase UID, OIDC `sub`, normalized email.
   */
  claim: string;

  /**
   * Backward/forward compatibility alias.
   * Prefer `claim` in new code.
   */
  providerSecret?: IdentityProviderSecret;

  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}

