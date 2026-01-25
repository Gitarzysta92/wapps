import { Result } from '@foundation/standard';
import { IAuthorityValidationContext } from "../models/authority-validation-context";

export interface IPolicyEvaluator {
  evaluate( ctx: IAuthorityValidationContext): Promise<Result<boolean, Error>>;
}