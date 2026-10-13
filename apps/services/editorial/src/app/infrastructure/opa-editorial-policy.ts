import axios, { AxiosInstance } from 'axios';
import type {
  IAuthorityValidationContext,
  IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import { err, ok, Result } from '@sdk/kernel/standard';

export class OpaEditorialPolicy implements IPolicyEvaluator {
  private readonly http: AxiosInstance;
  constructor(baseUrl: string, timeoutMs = 1500) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs,
      maxContentLength: 8192,
      maxRedirects: 0,
    });
  }

  async evaluate(
    input: IAuthorityValidationContext
  ): Promise<Result<boolean, Error>> {
    try {
      const response = await this.http.post<{ result?: unknown }>(
        '/v1/data/wapps/editorial/authz/allow',
        { input }
      );
      return ok(response.data?.result === true);
    } catch {
      return err(new Error('Editorial policy evaluation unavailable'));
    }
  }
}
