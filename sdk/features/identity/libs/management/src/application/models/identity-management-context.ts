import { IAuthorityValidationContext } from '@sdk/kernel/ontology/authority';

/**
 * Request context passed from the app layer to domain operations.
 */
export type IdentityManagementContext = Omit<IAuthorityValidationContext, 'actionName' | 'resource'>;

