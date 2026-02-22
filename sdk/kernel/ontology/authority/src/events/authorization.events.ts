import { IAuthorityValidationContext } from '../models/authority-validation-context';

/**
 * Optional event contracts for auditing/observability.
 *
 * This is especially useful with OPA where you may want to log decision inputs,
 * outputs, and policy/bundle revisions for traceability.
 */
export interface IAuthorizationDecision {
  allow: boolean;
  /**
   * Optional human-readable reasons from policy evaluation.
   * (OPA commonly uses `deny` sets; you can map them here.)
   */
  reasons?: string[];
  /** Optional policy/bundle revision identifier. */
  policyRevision?: string;
}

export interface IAuthorizationDecisionEvent {
  type: 'authorization.decision';
  timestamp: number;
  ctx: IAuthorityValidationContext;
  decision: IAuthorizationDecision;
}

