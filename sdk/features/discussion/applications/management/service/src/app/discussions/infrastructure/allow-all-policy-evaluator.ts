import { IPolicyEvaluator, IAuthorityValidationContext } from '@sdk/kernel/ontology/authority';
import { ok, Result } from '@sdk/kernel/standard';

export class AllowAllPolicyEvaluator implements IPolicyEvaluator {
  async evaluate(_ctx: IAuthorityValidationContext): Promise<Result<boolean, Error>> {
    return ok(true);
  }
}

