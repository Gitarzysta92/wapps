import { IAuthorityValidationContext } from "@foundation/authority-system";
import { IOperationContext } from "@foundation/workflow-system";

export type CommentCreationContext = Omit<IAuthorityValidationContext, 'actionName'> & IOperationContext;