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
  /** If true, require resource.tenantId to equal input.tenantId (only if your system uses tenancy). */
  tenantMustMatchInput?: boolean;
}

export interface DiscussionPolicyDefinition {
  packageName: string;
  supportedActions: ActionName[];
  rolePermissions: Record<RoleName, ActionName[]>;
  /**
   * Per-action resource constraints, evaluated by generated Rego.
   * Only specify constraints when action requires resource facts.
   */
  resourceConstraints?: Record<ActionName, ResourceConstraint>;
  /**
   * Optional example assignment mapping (handy for local testing).
   */
  rolesByIdentityExample?: PolicyDataModel['roles_by_identity'];
}

