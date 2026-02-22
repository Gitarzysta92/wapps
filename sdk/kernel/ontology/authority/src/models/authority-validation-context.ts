import { IAuthorityResourceRef } from './resource';

export interface IAuthorityValidationContext {
  identityId: string;

  /**
   * Optional scope/partition identifier (only if your system uses it).
   * Leave undefined in single-tenant setups.
   */
  tenantId?: string;

  timestamp: number;
  /**
   * Action identifier used by policies.
   *
   * Keep `actionName` for backwards compatibility with existing call sites.
   * New code can use `action`.
   */
  actionName: string;
  action?: string;

  /**
   * Optional resource facts for ABAC-style policies.
   * Without resource facts, policies are limited to coarse action-based RBAC.
   */
  resource?: IAuthorityResourceRef;

  /**
   * Optional subject facts for policies (roles/groups/claims).
   * These are useful when you don't want OPA to query external sources.
   */
  subject?: {
    roles?: string[];
    groups?: string[];
    claims?: Record<string, unknown>;
  };

  /**
   * Optional request/environment context.
   * Useful for time-based rules, device/IP restrictions, and auditing.
   */
  context?: Record<string, unknown>;
}
