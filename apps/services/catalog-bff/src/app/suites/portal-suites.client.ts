import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  parsePrivateSuite,
  parseSuiteReceipt,
  SUITE_LIMITS,
  type SuiteFields,
} from '@domains/publication/suite';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';

export interface PortalSuiteChange {
  method: 'POST' | 'PUT' | 'DELETE';
  id: string | null;
  expectedRevision: number | null;
  fields: SuiteFields | null;
}

const errors: Record<number, string> = {
  400: 'Check the suite fields and selected applications',
  401: 'Sign in again to access your suites',
  403: 'Suite access denied',
  404: 'Suite not found or no longer available to this account',
  409: 'This suite changed or its limit was reached. Reload before editing.',
  413: 'Suite request exceeds the size limit',
  429: 'Too many suite requests. Try again later.',
};

function unavailable() {
  return new ServiceUnavailableException(
    'Could not confirm the suite operation. Retry the same request.'
  );
}

@Injectable()
export class PortalSuitesClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async list(actor: TrustedPortalIdentity) {
    const raw = await this.send(actor);
    return this.decode(() => {
      if (!Array.isArray(raw) || raw.length > SUITE_LIMITS.perOwner)
        throw new Error('Invalid suite list');
      const suites = raw.map(parsePrivateSuite);
      if (new Set(suites.map((suite) => suite.id)).size !== suites.length)
        throw new Error('Duplicate suite');
      return suites;
    });
  }

  async read(actor: TrustedPortalIdentity, id: string) {
    const raw = await this.send(actor, id);
    return this.decode(() => {
      const suite = parsePrivateSuite(raw);
      if (suite.id !== id) throw new Error('Unexpected suite');
      return suite;
    });
  }

  async change(
    actor: TrustedPortalIdentity,
    command: PortalSuiteChange,
    key: string
  ) {
    const body =
      command.method === 'POST'
        ? command.fields
        : { ...command.fields, expectedRevision: command.expectedRevision };
    const raw = await this.send(actor, command.id, command.method, body, key);
    return this.decode(() => {
      const receipt = parseSuiteReceipt(raw);
      if (
        (command.id !== null && receipt.id !== command.id) ||
        receipt.revision !== (command.expectedRevision ?? 0) + 1 ||
        receipt.deleted !== (command.method === 'DELETE')
      )
        throw new Error('Unexpected suite receipt');
      return receipt;
    });
  }

  private async send(
    actor: TrustedPortalIdentity,
    id: string | null = null,
    method: 'GET' | PortalSuiteChange['method'] = 'GET',
    body?: unknown,
    key?: string
  ): Promise<unknown> {
    try {
      const configured = this.config.get<string>('EDITORIAL_URL');
      if (!configured) throw unavailable();
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw unavailable();
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: url.origin + '/api/me/suites' + (id === null ? '' : '/' + id),
          method,
          ...(body === undefined ? {} : { data: body }),
          headers: {
            ...actor.headers,
            Accept: 'application/json',
            ...(key
              ? { 'Content-Type': 'application/json', 'Idempotency-Key': key }
              : {}),
          },
          timeout: 15_000,
          signal: AbortSignal.timeout(15_000),
          maxRedirects: 0,
          maxBodyLength: 64 * 1024,
          maxContentLength: 1024 * 1024,
          responseType: 'json',
        })
      );
      if (
        response.status !== (method === 'POST' ? 201 : 200) ||
        !/^application\/json(?:\s*;|$)/i.test(
          String(response.headers['content-type'])
        )
      )
        throw unavailable();
      return response.data;
    } catch (error) {
      if (
        isAxiosError(error) &&
        error.response &&
        errors[error.response.status]
      )
        throw new HttpException(
          errors[error.response.status],
          error.response.status
        );
      // The owner may have committed before a connection failed. Never retry a command here.
      throw unavailable();
    }
  }

  private decode<T>(parse: () => T): T {
    try {
      return parse();
    } catch {
      throw unavailable();
    }
  }
}
