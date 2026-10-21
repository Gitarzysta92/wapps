import {
  Injectable,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  parseAccountFavorites,
  parseFavoriteChangeReceipt,
  parseFavoriteUpdatePage,
  favoriteUpdateObject,
  favoriteUpdateId,
  favoriteUpdateTime,
  type FavoriteChange,
} from '@domains/customer/favorites';
import {
  replyInboxPage,
  mentionInboxPage,
  notificationTimestamp,
} from '@domains/community';
import { parseCatalogSelection } from '@domains/catalog/record';
import { parseArticleSelection } from '@domains/publication/article';
import { parsePublicSuiteSelection } from '@domains/publication/suite';
import { applicationBoundSelection } from '../discussions/portal-bound-discussions.contract';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';

export type InboxKind = 'replies' | 'mentions' | 'favorites';
const inboxPaths = {
  replies: '/api/me/notifications',
  mentions: '/api/me/notifications/mentions',
  favorites: '/api/me/notifications/favorites',
} as const;
type AccountPath =
  | '/api/me/favorites'
  | (typeof inboxPaths)[InboxKind]
  | `${(typeof inboxPaths)[InboxKind]}/read`;
const errors: Record<number, string> = {
  400: 'Invalid favorites or notification request',
  401: 'Sign in again to access your account',
  403: 'Account access denied',
  404: 'Saved item or notification unavailable',
  409: 'Your account changed. Reload before trying again.',
  413: 'Request exceeds the size limit',
  429: 'Too many account requests. Try again later.',
};

@Injectable()
export class PortalMemberClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async favorites(actor: TrustedPortalIdentity, signal?: AbortSignal) {
    const value = await this.account(
      actor,
      '/api/me/favorites',
      undefined,
      undefined,
      undefined,
      signal
    );
    return this.decode(() => {
      const result = parseAccountFavorites(value);
      if (result.identityId !== actor.identityId)
        throw new Error('Unexpected account');
      return result;
    });
  }
  async change(
    actor: TrustedPortalIdentity,
    input: FavoriteChange,
    key: string
  ) {
    const value = await this.account(actor, '/api/me/favorites', input, key);
    return this.decode(() => {
      const result = parseFavoriteChangeReceipt(value);
      if (
        result.identityId !== actor.identityId ||
        result.revision !== input.expectedRevision + 1
      )
        throw new Error('Unexpected receipt');
      return result;
    });
  }
  async inbox(
    actor: TrustedPortalIdentity,
    kind: InboxKind,
    cursor: string | undefined
  ) {
    const value = await this.account(
      actor,
      inboxPaths[kind],
      undefined,
      undefined,
      cursor ? { cursor } : undefined
    );
    return this.decode(() =>
      kind === 'favorites'
        ? parseFavoriteUpdatePage(value)
        : kind === 'mentions'
        ? mentionInboxPage(value)
        : replyInboxPage(value)
    );
  }
  async markRead(actor: TrustedPortalIdentity, kind: InboxKind, id: string) {
    const value = await this.account(actor, `${inboxPaths[kind]}/read`, { id });
    return this.decode(() => {
      const row = favoriteUpdateObject(value, ['id', 'readAt']);
      if (favoriteUpdateId(row['id']) !== id)
        throw new Error('Unexpected receipt');
      return {
        id,
        readAt:
          kind === 'favorites'
            ? favoriteUpdateTime(row['readAt'])
            : notificationTimestamp(row['readAt'], 1),
      };
    });
  }
  apps(ids: string[], signal: AbortSignal) {
    return this.selection(
      'EDITORIAL_URL',
      '/api/catalog/app-selection',
      ids,
      parseCatalogSelection,
      signal
    );
  }
  articles(ids: string[], signal: AbortSignal) {
    return this.selection(
      'EDITORIAL_URL',
      '/api/catalog/article-selection',
      ids,
      parseArticleSelection,
      signal
    );
  }
  suites(ids: string[], signal: AbortSignal) {
    return this.selection(
      'EDITORIAL_URL',
      '/api/catalog/suite-selection',
      ids,
      parsePublicSuiteSelection,
      signal
    );
  }
  discussions(ids: string[], signal: AbortSignal) {
    return this.selection(
      'DISCUSSION_URL',
      '/api/discussions/selection?bindingPrefix=application%3A&includeVotes=true',
      ids,
      applicationBoundSelection,
      signal
    );
  }

  private async selection<T>(
    origin: 'EDITORIAL_URL' | 'DISCUSSION_URL',
    path: string,
    ids: string[],
    parse: (value: unknown, ids: string[]) => { items: T[] },
    signal: AbortSignal
  ) {
    const items: T[] = [];
    for (let offset = 0; offset < ids.length; offset += 50) {
      const batch = ids.slice(offset, offset + 50);
      const value = await this.send(
        origin,
        path,
        undefined,
        undefined,
        { ids: batch.join(',') },
        signal
      );
      items.push(...this.decode(() => parse(value, batch)).items);
    }
    return items;
  }
  private account(
    actor: TrustedPortalIdentity,
    path: AccountPath,
    data?: FavoriteChange | { id: string },
    key?: string,
    params?: Record<string, string>,
    signal?: AbortSignal
  ) {
    return this.send(
      'ACCOUNT_MANAGEMENT_URL',
      path,
      data,
      { ...actor.headers, ...(key ? { 'Idempotency-Key': key } : {}) },
      params,
      signal
    );
  }
  private async send(
    origin: 'ACCOUNT_MANAGEMENT_URL' | 'EDITORIAL_URL' | 'DISCUSSION_URL',
    path: string,
    data?: unknown,
    headers?: Record<string, string>,
    params?: Record<string, string>,
    signal?: AbortSignal
  ) {
    try {
      const configured = this.config.get<string>(origin);
      if (!configured) throw new Error('Unconfigured service');
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error('Invalid service origin');
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: url.origin + path,
          method: data === undefined ? 'GET' : 'PUT',
          data,
          params,
          signal,
          headers: { Accept: 'application/json', ...headers },
          timeout: signal ? 5000 : 15000,
          maxRedirects: 0,
          maxContentLength:
            origin === 'ACCOUNT_MANAGEMENT_URL'
              ? 64 * 1024
              : origin === 'DISCUSSION_URL'
              ? 2 * 1024 * 1024
              : 1024 * 1024,
          maxBodyLength: 64 * 1024,
        })
      );
      if (
        response.status !== 200 ||
        !/^application\/json(?:\s*;|$)/i.test(
          String(response.headers['content-type'])
        )
      )
        throw new Error('Invalid service response');
      return response.data;
    } catch (error) {
      if (origin === 'ACCOUNT_MANAGEMENT_URL' && isAxiosError(error)) {
        const status = error.response?.status;
        if (status && errors[status])
          throw new HttpException(errors[status], status);
      }
      // A write can commit before its reply is lost. Retry remains the caller's decision.
      throw new ServiceUnavailableException(
        'Could not confirm favorites or notifications. Reload or retry the same change.'
      );
    }
  }
  private decode<T>(parse: () => T): T {
    try {
      return parse();
    } catch {
      throw new ServiceUnavailableException(
        'Favorites or notification response could not be confirmed'
      );
    }
  }
}
