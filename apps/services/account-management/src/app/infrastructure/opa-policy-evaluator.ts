import axios, { AxiosInstance } from 'axios';
import { IAuthorityValidationContext, IPolicyEvaluator } from '@foundation/authority-system';
import { err, ok, Result } from '@foundation/standard';

type OpaQueryResponse<T> = {
  result: T;
};

/**
 * OPA-backed policy evaluator for Account Management service.
 *
 * Queries: POST /v1/data/wapps/identity_admin/authz/allow with body { input: ctx }.
 */
export class OpaPolicyEvaluator implements IPolicyEvaluator {
  private readonly http: AxiosInstance;
  private readonly allowPath: string;

  constructor(opts?: { baseUrl?: string; allowPath?: string; timeoutMs?: number }) {
    const baseUrl = opts?.baseUrl ?? process.env.OPA_URL ?? 'http://localhost:8181';
    this.allowPath =
      opts?.allowPath ?? process.env.OPA_IDENTITY_ADMIN_ALLOW_PATH ?? '/v1/data/wapps/identity_admin/authz/allow';

    this.http = axios.create({
      baseURL: baseUrl,
      timeout: opts?.timeoutMs ?? Number(process.env.OPA_TIMEOUT_MS ?? 1500),
      headers: {
        'content-type': 'application/json',
      },
    });
  }

  async evaluate(ctx: IAuthorityValidationContext): Promise<Result<boolean, Error>> {
    try {
      const res = await this.http.post<OpaQueryResponse<boolean>>(this.allowPath, {
        input: ctx,
      });
      return ok(res.data?.result === true);
    } catch (e) {
      const message = e instanceof Error ? e.message : typeof e === 'string' ? e : 'OPA request failed';
      return err(new Error(message));
    }
  }
}

