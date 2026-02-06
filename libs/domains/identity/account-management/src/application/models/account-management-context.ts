import { IAuthorityValidationContext } from '@foundation/authority-system';

/**
 * Request context passed from the app layer to domain operations.
 * Mirrors `CommentCreationContext` pattern from `@domains/discussion`.
 */
export type AccountManagementContext = Omit<IAuthorityValidationContext, 'actionName' | 'resource'>;

