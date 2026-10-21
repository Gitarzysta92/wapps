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
  parsePublicSuite,
  parsePublicSuitePage,
  parsePublicSuiteSelection,
  parseSuitePublicationReceipt,
  parseSuitePublicationStatus,
  parseSuiteReviewPage,
  type PublicSuiteQuery,
  type SuitePublicationAction,
  type SuitePublicationInput,
} from '@domains/publication/suite';
import type { TrustedPortalViewer } from '../identity/trusted-portal-identity';

const errors: Record<number, string> = {
  400: 'Invalid suite publication request',
  401: 'Sign in again to access suite publication',
  403: 'Suite publication access denied',
  404: 'Suite not found or no longer available',
  409: 'This suite changed. Reload before continuing.',
  413: 'Suite request exceeds the size limit',
  429: 'Too many suite requests. Try again later.',
};

function unavailable() {
  return new ServiceUnavailableException(
    'Could not confirm the suite operation. Retry the same request.'
  );
}

@Injectable()
export class PortalSuitePublicationClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async status(actor: TrustedPortalViewer, id: string, review: boolean) {
    const raw = await this.send(
      actor,
      review
        ? `/api/editorial/suite-reviews/${id}`
        : `/api/me/suites/${id}/publication`
    );
    return this.decode(() => {
      const status = parseSuitePublicationStatus(raw);
      if (status.id !== id) throw new Error('Unexpected suite');
      return status;
    });
  }

  async reviews(actor: TrustedPortalViewer, page: number) {
    const raw = await this.send(
      actor,
      `/api/editorial/suite-reviews?page=${page}`
    );
    return this.decode(() => {
      const result = parseSuiteReviewPage(raw);
      if (
        result.page !== page ||
        result.items.length > Math.max(0, result.total - (page - 1) * 20)
      )
        throw new Error('Unexpected review page');
      return result;
    });
  }

  async change(
    actor: TrustedPortalViewer,
    id: string,
    action: SuitePublicationAction,
    input: SuitePublicationInput,
    key: string
  ) {
    const review = action === 'approve' || action === 'reject';
    const body = review
      ? {
          decision: action,
          expectedRevision: input.expectedRevision,
          submittedRevision: input.submittedRevision,
          reason: input.reason,
        }
      : { expectedRevision: input.expectedRevision };
    const raw = await this.send(
      actor,
      review
        ? `/api/editorial/suite-reviews/${id}/decision`
        : `/api/me/suites/${id}/${action}`,
      body,
      key
    );
    return this.decode(() => {
      const receipt = parseSuitePublicationReceipt(raw);
      if (
        receipt.id !== id ||
        receipt.action !== action ||
        receipt.revision !== input.expectedRevision + 1 ||
        (review && receipt.submittedRevision !== input.submittedRevision) ||
        (action === 'submit' &&
          receipt.submittedRevision !== input.expectedRevision) ||
        (action === 'approve' && receipt.publicationRevision === null) ||
        (receipt.submittedRevision !== null &&
          receipt.submittedRevision >= receipt.revision)
      )
        throw new Error('Unexpected publication receipt');
      return receipt;
    });
  }

  async browse(actor: TrustedPortalViewer, query: PublicSuiteQuery) {
    const params = new URLSearchParams({
      q: query.q,
      page: String(query.page),
    });
    if (query.pageSize !== undefined)
      params.set('pageSize', String(query.pageSize));
    if (query.sort !== undefined) params.set('sort', query.sort);
    const raw = await this.send(actor, '/api/catalog/suites?' + params);
    return this.decode(() => {
      const result = parsePublicSuitePage(raw);
      if (
        result.page !== query.page ||
        (result.pageSize ?? 20) !== (query.pageSize ?? 20)
      )
        throw new Error('Unexpected public suite page');
      return result;
    });
  }

  async find(actor: TrustedPortalViewer, id: string) {
    const raw = await this.send(actor, '/api/catalog/suites/' + id);
    return this.decode(() => {
      const suite = parsePublicSuite(raw);
      if (suite.id !== id) throw new Error('Unexpected public suite');
      return suite;
    });
  }

  async select(actor: TrustedPortalViewer, ids: string[]) {
    const raw = await this.send(
      actor,
      '/api/catalog/suite-selection?' +
        new URLSearchParams({ ids: ids.join(',') })
    );
    return this.decode(() => parsePublicSuiteSelection(raw, ids));
  }

  private async send(
    actor: TrustedPortalViewer,
    path: string,
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
          url: url.origin + path,
          method: body === undefined ? 'GET' : 'POST',
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
        response.status !== (body === undefined ? 200 : 201) ||
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
      // A failed reply can follow a committed command; only the caller may replay its key.
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
