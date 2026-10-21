import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';
import {
  healthMonitorConfigurations,
  healthMonitorReceipt,
  type HealthMonitorInput,
} from './portal-health-monitors.contracts';

const errors: Record<number, string> = {
  400: 'Invalid health monitor configuration',
  401: 'Sign in again to manage health monitors',
  403: 'Health monitor access denied',
  404: 'Application or health monitor unavailable',
  409: 'The application or health monitor configuration conflicts with this request',
  429: 'Too many health monitor requests',
};

@Injectable()
export class PortalHealthMonitorsClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  configurations(actor: TrustedPortalIdentity, applicationId: string) {
    return this.send(actor, applicationId, undefined, (data) =>
      healthMonitorConfigurations(applicationId, data)
    );
  }

  configure(
    actor: TrustedPortalIdentity,
    applicationId: string,
    id: string,
    body: HealthMonitorInput
  ) {
    return this.send(actor, applicationId, { id, body }, (data) =>
      healthMonitorReceipt(applicationId, id, body, data)
    );
  }

  private async send<T>(
    actor: TrustedPortalIdentity,
    applicationId: string,
    command: { id: string; body: HealthMonitorInput } | undefined,
    parse: (data: unknown) => T
  ): Promise<T> {
    try {
      const configured = this.config.get<string>('EDITORIAL_URL');
      if (!configured) throw new Error('Editorial unconfigured');
      const origin = new URL(configured);
      if (
        !['http:', 'https:'].includes(origin.protocol) ||
        origin.pathname !== '/' ||
        origin.username ||
        origin.password ||
        origin.search ||
        origin.hash
      )
        throw new Error('Invalid Editorial origin');
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: `${
            origin.origin
          }/api/editorial/health-monitors/${encodeURIComponent(applicationId)}${
            command ? '/' + encodeURIComponent(command.id) : ''
          }`,
          method: command ? 'PUT' : 'GET',
          data: command?.body,
          headers: { ...actor.headers, Accept: 'application/json' },
          timeout: 10_000,
          signal: AbortSignal.timeout(10_000),
          maxRedirects: 0,
          maxBodyLength: 8192,
          maxContentLength: 32768,
          responseType: 'json',
        })
      );
      if (
        response.status !== 200 ||
        !/^application\/json(?:\s*;|$)/i.test(
          String(response.headers['content-type'])
        )
      )
        throw new Error('Invalid health monitor response');
      return parse(response.data);
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status && errors[status])
          throw new HttpException(errors[status], status);
      }
      // Editorial may commit before a reply is lost. Only the caller can replay its revisions.
      throw new ServiceUnavailableException(
        'Could not confirm health monitor configuration'
      );
    }
  }
}
