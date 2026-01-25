import { Result } from '@foundation/standard';
import { IValidationContext } from "../models/validation-context";

export interface IPolicyEvaluator {
  evaluate( ctx: IValidationContext): Promise<Result<boolean, Error>>;
}