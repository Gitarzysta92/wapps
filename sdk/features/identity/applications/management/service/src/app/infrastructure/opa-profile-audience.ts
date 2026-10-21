import axios, { type AxiosInstance } from 'axios';
import type { ProfileAudiencePolicy } from '@wapps/account';
import { err, ok, type Result } from '@sdk/kernel/standard';

export class OpaProfileAudience implements ProfileAudiencePolicy {
  private readonly http: AxiosInstance;
  constructor(baseUrl: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 1500,
      maxRedirects: 0,
      maxContentLength: 1024,
      maxBodyLength: 4096,
    });
  }

  async evaluate(
    ...[action, facts, requesterId]: Parameters<
      ProfileAudiencePolicy['evaluate']
    >
  ): Promise<Result<boolean, Error>> {
    try {
      const response = await this.http.post<{ result?: unknown }>(
        '/v1/data/wapps/profile_audience/authz/allow',
        { input: { ...facts, action, requesterId: requesterId ?? null } }
      );
      if (typeof response.data?.result !== 'boolean')
        throw new Error('Invalid audience decision');
      return ok(response.data.result);
    } catch {
      return err(new Error('Profile authorization unavailable'));
    }
  }
}
