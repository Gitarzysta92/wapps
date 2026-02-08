import { IAuthorityValidationContext } from '@foundation/authority-system';

/**
 * Request context passed from the app layer to domain operations.
 */
export type IdentityManagementContext = Omit<IAuthorityValidationContext, 'actionName' | 'resource'>;

