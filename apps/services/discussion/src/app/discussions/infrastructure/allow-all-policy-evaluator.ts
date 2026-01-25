import { IPolicyEvaluator } from '@foundation/authority-system';
import { ok, Result } from '@foundation/standard';
import { IAuthorityValidationContext } from '@foundation/authority-system';

export class AllowAllPolicyEvaluator implements IPolicyEvaluator {
  async evaluate(_ctx: IAuthorityValidationContext): Promise<Result<boolean, Error>> {
    return ok(true);
  }
}

