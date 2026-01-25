import { Result } from '@foundation/standard';
import { IAuthorityValidationContext } from "./models/authority-validation-context";
import { IPolicyEvaluator } from './ports/policy-evaluator.port';

export abstract class AuthorityValidationService {
  constructor(
    private readonly policyEvaluator: IPolicyEvaluator,
  ) {}

  async validate(ctx: IAuthorityValidationContext): Promise<Result<boolean, Error>> {
    return this.policyEvaluator.evaluate(ctx);
  }
}