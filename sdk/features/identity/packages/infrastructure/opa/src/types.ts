export type ActionName = string;
export type RoleName = string;
export type IdentityId = string;

export interface PolicyDataModel {
  /**
   * Role -> list of actions it permits. `"*"` means allow all actions.
   */
  permissions_by_role: Record<RoleName, ActionName[]>;

  /**
   * Identity -> roles.
   * Optional convenience lookup (policies can also accept roles in input).
   */
  roles_by_identity?: Record<IdentityId, RoleName[]>;
}

export interface ResourceConstraint {
  /** Required resource.type */
  type: string;
  /** Require resource.id to be non-empty */
  requireId?: boolean;
  /** Fixed service resource; non-empty identifiers alone do not establish scope. */
  exactId?: string;
  /** If true, require a non-empty resource.tenantId equal to input.tenantId. */
  tenantMustMatchInput?: boolean;
  /** Restricts the resource to the authenticated actor, including administrators. */
  identityMustMatchInput?: boolean;
  /** Exact internal service identity/scope/role; an administrator role cannot override this. */
  serviceOnly?: { identityId: string; tenantId: string; role: string };
}

export interface AuthorizationPolicyDefinition {
  packageName: string;
  supportedActions: ActionName[];
  rolePermissions: Record<RoleName, ActionName[]>;
  /** Authenticated actions whose resource constraint must enforce self access. */
  selfActions?: ActionName[];
  /**
   * Per-action resource constraints, evaluated by generated Rego.
   * Only specify constraints when action requires resource facts.
   */
  resourceConstraints?: Record<ActionName, ResourceConstraint>;
}

export type DiscussionPolicyDefinition = AuthorizationPolicyDefinition;
