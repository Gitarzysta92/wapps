import { Result } from '@foundation/standard';
import { IValidationContext } from "./models/validation-context";
import { IPolicyEvaluator } from './ports/policy-evaluator.port';

export abstract class AuthorityValidationService {
  constructor(
    private readonly policyEvaluator: IPolicyEvaluator,
  ) {}

  async validate(ctx: IValidationContext): Promise<Result<boolean, Error>> {
    return this.policyEvaluator.evaluate(ctx);
  }
}