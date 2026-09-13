/**
 * Identity domain events.
 *
 * This file must be a TS module (export something), because it is re-exported
 * from the identity ontology package entrypoint.
 */

export type IdentityEventType =
  | 'identity.created'
  | 'identity.updated'
  | 'identity.deleted';

export interface IdentityEventBase<TType extends IdentityEventType = IdentityEventType> {
  type: TType;
  identityId: string;
  tenantId: string;
  timestamp: number;
}

