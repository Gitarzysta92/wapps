/**
 * Authorization "resource" description used as part of policy evaluation input.
 *
 * Keep this separate from domain models (content-system, etc.) so the authority
 * system does not own other bounded contexts. This is just the minimum shape
 * policies may need to reason about the current target.
 */
export interface IAuthorityResourceRef {
  /** Stable resource type identifier (domain-specific). Example: "comment". */
  type: string;

  /** Optional identifier of the concrete resource instance. */
  id?: string;

  /**
   * Optional scope/partition identifier (only if your system uses it).
   * Leave undefined in single-tenant setups.
   */
  tenantId?: string;

  /** Optional ownership hint, if known at the call site. */
  ownerIdentityId?: string;

  /** Arbitrary additional attributes used by policies (ABAC). */
  attributes?: Record<string, unknown>;
}

