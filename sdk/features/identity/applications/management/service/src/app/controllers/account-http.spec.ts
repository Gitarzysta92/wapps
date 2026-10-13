import { MysqlFavoriteUpdates } from '@sdk/extras/identity-mysql';
import { RemoteFavoriteUpdates } from '../infrastructure/remote-favorite-updates';
import { FavoriteUpdateWorker } from '../infrastructure/favorite-update-worker';
import type { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  MysqlAccountExports,
  MysqlReplyInbox,
} from '@sdk/extras/identity-mysql';
import { RemoteReplyNotifications } from '../infrastructure/remote-reply-notifications';
import { ReplyNotificationWorker } from '../infrastructure/reply-notification-worker';
import { AccountExportWorker } from '../infrastructure/account-export-worker';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import { MysqlAccountFavorites } from '@sdk/extras/identity-mysql';
import { PublicFavoriteTargets } from '../infrastructure/public-favorite-targets';
import { CanonicalIdentityConflict } from '@sdk/features/identity/core';
import { FirebaseAdminUserAdminPort } from '@sdk/extras/identity-firebase';
import { ok, err } from '@sdk/kernel/standard';
import {
  ACCOUNT_STATE,
  CANONICAL_IDENTITIES,
  PASSWORD_RECOVERY,
} from '../services/identity-state.tokens';
import { IdentityWorkers } from '../infrastructure/identity-workers';
import { AccountErrorFilter } from './account-error.filter';
import {
  PublicProfileFavoritesService,
  PublicProfileSuitesService,
  PublicProfileArticlesService,
  PublicProfileDiscussionsService,
  ProfileBadgesService,
  ProfileTotalsService,
} from '@sdk/features/identity/libs/management';

describe('account production HTTP composition', () => {
  const state = {
    identityId: 'Uid',
    subjectId: 'subject',
    revision: 1,
    isActive: true,
    isSuspended: false,
    isDeleted: false,
  };
  const identities = {
    find: jest.fn(),
    ensure: jest.fn(),
    setSuspended: jest.fn(),
    requestDeletion: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
  };
  const accounts = { account: jest.fn(), completeRegistration: jest.fn() };
  const credentials = {
    updateUser: jest.fn(),
    revokeRefreshTokens: jest.fn(),
    deleteUser: jest.fn(),
    generatePasswordResetLink: jest.fn(),
    generateEmailVerificationLink: jest.fn(),
  };
  const recovery = { send: jest.fn() };
  const favorites = {
    read: jest.fn(),
    inspectChange: jest.fn(),
    change: jest.fn(),
  };
  const favoriteSource = { read: jest.fn() };
  const favoriteInbox = {
    list: jest.fn(),
    current: jest.fn(),
    markRead: jest.fn(),
  };
  const favoriteTargets = { available: jest.fn() };
  const publicFavorites = { read: jest.fn() };
  const publicArticles = { read: jest.fn() };
  const publicSuites = { read: jest.fn() };
  const publicDiscussions = { read: jest.fn() };
  const badges = {
    capabilities: jest.fn(),
    administer: jest.fn(),
    change: jest.fn(),
    own: jest.fn(),
    shared: jest.fn(),
  };
  const totals = { own: jest.fn(), shared: jest.fn() };
  const inbox = {
    list: jest.fn(),
    current: jest.fn(),
    markRead: jest.fn(),
    receive: jest.fn(),
  };
  const notificationSource = {
    resolve: jest.fn(),
    claim: jest.fn(),
    settle: jest.fn(),
  };
  const validate = jest.fn();
  const exports = {
    request: jest.fn(),
    latest: jest.fn(),
    inspect: jest.fn(),
    cancel: jest.fn(),
    download: jest.fn(),
  };
  const exportId = '00000000-0000-4000-8000-000000000042';
  const archive = gzipSync('{"data":"My complete export"}\n');
  const readyExport = {
    id: exportId,
    status: 'ready',
    requestedAt: 1,
    expiresAt: 86_400_001,
    readyAt: 2,
    bytes: archive.length,
    sha256: createHash('sha256').update(archive).digest('hex'),
    attempts: 1,
    failure: null,
  };
  let app: INestApplication;
  let origin: string;
  const env = {
    MYSQL_HOST: 'unused',
    MYSQL_PORT: '3306',
    MYSQL_DATABASE: 'test',
    MYSQL_USERNAME: 'test',
    MYSQL_PASSWORD: 'test',
    QUEUE_HOST: 'unused',
    QUEUE_USERNAME: 'test',
    QUEUE_PASSWORD: 'test',
    FIREBASE_PROJECT_ID: 'test',
    FIREBASE_WEB_API_KEY: 'test',
    INGRESS_AUTH_SECRET: 'test-ingress',
    ACCOUNT_EXPORT_SOURCE_SECRET: 'qualification-export-secret-2026-only',
    ACCOUNT_ERASURE_SECRET: 'qualification-erasure-secret-2026-only',
    FAVORITE_UPDATE_WORKER_ENABLED: 'true',
    NOTIFICATION_SERVICE_SECRET: 'qualification-notification-secret-2026-only',
    OPA_URL: 'http://unused:8181',
    EDITORIAL_URL: 'http://unused:1337',
    DISCUSSION_URL: 'http://unused:1338',
  };
  const previous = new Map<string, string | undefined>();

  beforeAll(async () => {
    for (const [key, value] of Object.entries(env)) {
      previous.set(key, process.env[key]);
      process.env[key] = value;
    }
    const { AppModule } = await import('../app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue({ options: { type: 'mysql' }, entityMetadatas: [] })
      .overrideProvider(MysqlReplyInbox)
      .useValue(inbox)
      .overrideProvider(RemoteFavoriteUpdates)
      .useValue(favoriteSource)
      .overrideProvider(MysqlFavoriteUpdates)
      .useValue(favoriteInbox)
      .overrideProvider(FavoriteUpdateWorker)
      .useValue({})
      .overrideProvider(RemoteReplyNotifications)
      .useValue(notificationSource)
      .overrideProvider(ReplyNotificationWorker)
      .useValue({})
      .overrideProvider(CANONICAL_IDENTITIES)
      .useValue(identities)
      .overrideProvider(ACCOUNT_STATE)
      .useValue(accounts)
      .overrideProvider(MysqlAccountFavorites)
      .useValue(favorites)
      .overrideProvider(PublicFavoriteTargets)
      .useValue(favoriteTargets)
      .overrideProvider(PublicProfileFavoritesService)
      .useValue(publicFavorites)
      .overrideProvider(PublicProfileArticlesService)
      .useValue(publicArticles)
      .overrideProvider(PublicProfileSuitesService)
      .useValue(publicSuites)
      .overrideProvider(PublicProfileDiscussionsService)
      .useValue(publicDiscussions)
      .overrideProvider(ProfileTotalsService)
      .useValue(totals)
      .overrideProvider(ProfileBadgesService)
      .useValue(badges)
      .overrideProvider(PASSWORD_RECOVERY)
      .useValue(recovery)
      .overrideProvider(IdentityWorkers)
      .useValue({})
      .overrideProvider(AccountExportWorker)
      .useValue({})
      .overrideProvider(MysqlAccountExports)
      .useValue(exports)
      .overrideProvider(FirebaseAdminUserAdminPort)
      .useValue(credentials)
      .overrideProvider(AuthorityValidationService)
      .useValue({ validate })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AccountErrorFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      })
    );
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  it('routes private and public totals with no-store, strict scope and optional public authentication', async () => {
    const value = { discussions: 31, favorites: 0, suites: 21, articles: 42 };
    totals.own.mockResolvedValue(ok(value));
    totals.shared.mockResolvedValue(ok(value));
    const mine = await request('me/totals');
    expect(mine.status).toBe(200);
    expect(await mine.json()).toEqual(value);
    const response = await request(
      'profiles/00000000-0000-4000-8000-000000000001/totals',
      'GET',
      undefined,
      { 'x-ingress-auth': 'test-ingress', 'x-anonymous': 'true' }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(totals.shared).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      null
    );
    expect((await request('me/totals?owner=other')).status).toBe(400);
    expect(
      (
        await request(
          'profiles/00000000-0000-4000-8000-000000000001/totals?tenantId=other'
        )
      ).status
    ).toBe(400);
  });
  beforeEach(() => {
    jest.resetAllMocks();
    const snapshot = { revision: 1, enabled: true, entries: [] };
    favoriteSource.read.mockImplementation(async (target) => ({
      target,
      version: 1,
      at: 100,
      content: {
        title: 'Application',
        destination: { kind: target.kind, slug: 'application' },
      },
    }));
    favoriteInbox.list.mockResolvedValue(snapshot);
    favoriteInbox.current.mockResolvedValue(snapshot);
    favoriteInbox.markRead.mockResolvedValue({ id: exportId, readAt: 200 });
    inbox.list.mockResolvedValue(snapshot);
    inbox.current.mockResolvedValue(snapshot);
    inbox.markRead.mockResolvedValue({ id: exportId, readAt: 200 });
    notificationSource.resolve.mockResolvedValue([]);
    exports.latest.mockResolvedValue(null);
    exports.request.mockResolvedValue({
      ...readyExport,
      status: 'queued',
      readyAt: null,
      bytes: null,
      sha256: null,
      attempts: 0,
    });
    exports.inspect.mockResolvedValue(readyExport);
    exports.cancel.mockResolvedValue({
      ...readyExport,
      status: 'cancelled',
      readyAt: null,
      bytes: null,
      sha256: null,
    });
    exports.download.mockImplementation(async function* () {
      yield archive;
    });
    identities.find.mockResolvedValue(state);
    identities.requestDeletion.mockResolvedValue({
      ...state,
      revision: 2,
      isDeleted: true,
      isActive: false,
      cleanup: 'pending',
    });
    identities.setSuspended.mockResolvedValue({
      ...state,
      revision: 2,
      isSuspended: true,
    });
    accounts.account.mockResolvedValue({
      ...state,
      status: 'STUB',
      createdAt: 100,
      updatedAt: 100,
      registeredAt: null,
      profile: { name: null, bio: null, location: null, avatarUri: null },
    });
    accounts.completeRegistration.mockResolvedValue({
      identityId: 'Uid',
      revision: 2,
      registered: true,
    });
    recovery.send.mockResolvedValue(undefined);
    validate.mockResolvedValue(ok(true));
    badges.capabilities.mockResolvedValue(
      ok({ kinds: ['verified', 'premium'] })
    );
    badges.own.mockResolvedValue(ok({ sharing: 'visible', items: [] }));
    badges.shared.mockResolvedValue(ok({ sharing: 'hidden', items: [] }));
    badges.administer.mockResolvedValue(ok({ revision: 0 }));
    badges.change.mockResolvedValue(ok({ revision: 1 }));
    favorites.read.mockResolvedValue({
      identityId: 'Uid',
      revision: 2,
      favorites: [],
    });
    favorites.inspectChange.mockResolvedValue(null);
    favorites.change.mockResolvedValue({ identityId: 'Uid', revision: 3 });
    favoriteTargets.available.mockResolvedValue(true);
    publicFavorites.read.mockResolvedValue(
      ok({ sharing: 'hidden', items: [], after: null })
    );
    publicArticles.read.mockResolvedValue(
      ok({ sharing: 'hidden', items: [], after: null })
    );
    publicSuites.read.mockResolvedValue(
      ok({ sharing: 'hidden', items: [], after: null })
    );
    publicDiscussions.read.mockResolvedValue(
      ok({ sharing: 'hidden', items: [], after: null })
    );
    identities.getProfile.mockResolvedValue({
      identityId: 'Uid',
      revision: 2,
      registeredAt: 100,
      updatedAt: 100,
      profile: {
        name: 'Alice',
        bio: null,
        location: null,
        avatarUri: null,
        socialLinks: {},
      },
    });
    identities.updateProfile.mockResolvedValue({
      identityId: 'Uid',
      revision: 3,
    });
    credentials.updateUser.mockResolvedValue(ok(true));
    identities.getPreferences.mockResolvedValue({
      identityId: 'Uid',
      revision: 2,
      updatedAt: null,
      preferences: defaultAccountPreferences(),
    });
    identities.updatePreferences.mockResolvedValue({
      identityId: 'Uid',
      revision: 3,
    });
  });
  const trusted = {
    'x-user-id': 'Uid',
    'x-ingress-auth': 'test-ingress',
    'x-user-claims': '{"roles":["admin"]}',
  };
  function request(
    path: string,
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = trusted
  ) {
    return fetch(`${origin}/api/${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  it('serves a no-store self inbox and records a self-scoped read receipt', async () => {
    const response = await request('me/notifications');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      enabled: true,
      items: [],
      next: null,
    });
    expect(inbox.list).toHaveBeenCalledWith('Uid', null);
    const update = await request('me/notifications/read', 'PUT', {
      id: exportId,
    });
    expect(update.status).toBe(200);
    expect(await update.json()).toEqual({ id: exportId, readAt: 200 });
    expect(inbox.markRead).toHaveBeenCalledWith('Uid', exportId);
  });
  it('rejects anonymous or injected inbox ownership and malformed read requests', async () => {
    expect(
      (await request('me/notifications', 'GET', undefined, {})).status
    ).toBe(401);
    expect((await request('me/notifications?identityId=Other')).status).toBe(
      400
    );
    expect((await request('me/notifications?cursor=invalid')).status).toBe(400);
    expect(
      (
        await request('me/notifications/read', 'PUT', {
          id: exportId,
          identityId: 'Other',
        })
      ).status
    ).toBe(400);
    expect(
      (
        await request('me/notifications/read?owner=Other', 'PUT', {
          id: exportId,
        })
      ).status
    ).toBe(400);
    expect(inbox.list).not.toHaveBeenCalled();
    expect(inbox.markRead).not.toHaveBeenCalled();
  });
  it('composes self favorite-update reads and read receipts with no-store and strict request scope', async () => {
    const response = await request('me/notifications/favorites');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      enabled: true,
      items: [],
      next: null,
    });
    expect(
      (
        await request('me/notifications/favorites/read', 'PUT', {
          id: exportId,
        })
      ).status
    ).toBe(200);
    expect(favoriteInbox.markRead).toHaveBeenCalledWith('Uid', exportId);
    expect(
      (await request('me/notifications/favorites?identityId=Other')).status
    ).toBe(400);
    expect(
      (
        await request('me/notifications/favorites/read', 'PUT', {
          id: exportId,
          identityId: 'Other',
        })
      ).status
    ).toBe(400);
    expect(
      (await request('me/notifications/favorites', 'GET', undefined, {})).status
    ).toBe(401);
    validate.mockResolvedValue(ok(false));
    favoriteInbox.list.mockClear();
    expect((await request('me/notifications/favorites')).status).toBe(403);
    expect(favoriteInbox.list).not.toHaveBeenCalled();
  });
  it('does not read notification authority after a false policy decision', async () => {
    validate.mockResolvedValue(ok(false));
    expect((await request('me/notifications')).status).toBe(403);
    expect(
      (await request('me/notifications/read', 'PUT', { id: exportId })).status
    ).toBe(403);
    expect(inbox.list).not.toHaveBeenCalled();
    expect(inbox.markRead).not.toHaveBeenCalled();
    expect(notificationSource.resolve).not.toHaveBeenCalled();
  });

  it('requests, reads and cancels only the authenticated account export', async () => {
    const latest = await request('me/exports');
    expect(await latest.json()).toEqual({ job: null });
    const accepted = await request(
      'me/exports',
      'POST',
      {},
      { ...trusted, 'idempotency-key': 'same-export-intent' }
    );
    expect(accepted.status).toBe(202);
    expect(accepted.headers.get('cache-control')).toBe('private, no-store');
    expect(await accepted.json()).toMatchObject({
      id: exportId,
      status: 'queued',
    });
    expect(exports.request).toHaveBeenCalledWith('Uid', 'same-export-intent');
    const status = await request(`me/exports/${exportId}`);
    expect(await status.json()).toEqual(readyExport);
    expect(exports.inspect).toHaveBeenCalledWith('Uid', exportId);
    expect((await request(`me/exports/${exportId}`, 'DELETE')).status).toBe(
      200
    );
    expect(exports.cancel).toHaveBeenCalledWith('Uid', exportId);
  });
  it('rejects export owner/query injection, absent keys and anonymous access', async () => {
    expect((await request('me/exports', 'POST', {})).status).toBe(400);
    expect(
      (
        await request(
          'me/exports',
          'POST',
          { identityId: 'Other' },
          { ...trusted, 'idempotency-key': 'key' }
        )
      ).status
    ).toBe(400);
    expect((await request('me/exports?identityId=Other')).status).toBe(400);
    expect(
      (await request(`me/exports/${exportId}?tenantId=Other`)).status
    ).toBe(400);
    expect(
      (
        await request(`me/exports/${exportId}`, 'DELETE', {
          identityId: 'Other',
        })
      ).status
    ).toBe(400);
    expect((await request('me/exports', 'GET', undefined, {})).status).toBe(
      401
    );
    expect(exports.request).not.toHaveBeenCalled();
    expect(exports.cancel).not.toHaveBeenCalled();
  });
  it('denies export policy false/outage before any job or archive I/O', async () => {
    validate.mockResolvedValue(ok(false));
    expect((await request(`me/exports/${exportId}/download`)).status).toBe(403);
    expect(exports.inspect).not.toHaveBeenCalled();
    validate.mockResolvedValue(err(new Error('OPA unavailable')));
    expect(
      (
        await request(
          'me/exports',
          'POST',
          {},
          { ...trusted, 'idempotency-key': 'key' }
        )
      ).status
    ).toBe(503);
    expect(exports.request).not.toHaveBeenCalled();
  });
  it('streams a verified gzip attachment with explicit length and private no-store', async () => {
    const response = await request(`me/exports/${exportId}/download`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/gzip');
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBe(String(archive.length));
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="wapps-account-${exportId}.ndjson.gz"`
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(archive);
    expect(exports.download).toHaveBeenCalledWith('Uid', exportId);
  });
  it('rejects unfinished jobs and partial-range download requests', async () => {
    exports.inspect.mockResolvedValue(await exports.request());
    expect((await request(`me/exports/${exportId}/download`)).status).toBe(409);
    expect(exports.download).not.toHaveBeenCalled();
    expect(
      (
        await request(`me/exports/${exportId}/download`, 'GET', undefined, {
          ...trusted,
          range: 'bytes=0-10',
        })
      ).status
    ).toBe(400);
  });
  it('rejects corrupt initial chunks without presenting an attachment', async () => {
    exports.download.mockImplementation(async function* () {
      yield Buffer.alloc(archive.length);
    });
    const response = await request(`me/exports/${exportId}/download`);
    expect(response.status).toBe(503);
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(await response.json()).toMatchObject({ statusCode: 503 });
  });
  it('aborts a partial HTTP response when a later canonical chunk fails', async () => {
    exports.download.mockImplementation(async function* () {
      yield archive.subarray(0, 5);
      await new Promise((resolve) => setTimeout(resolve, 20));
      throw new Error('Stored chunk unavailable');
    });
    const response = await request(`me/exports/${exportId}/download`);
    expect(response.status).toBe(200);
    await expect(response.arrayBuffer()).rejects.toThrow();
  });
  const preferencesUpdate = {
    expectedRevision: 2,
    preferences: defaultAccountPreferences(),
  };
  const publicProfileId = '00000000-0000-4000-8000-000000000001';
  it('routes canonical badge reads and commands with trusted actor claims and no caching', async () => {
    const capabilities = await request('admin/profile-badges');
    expect(capabilities.status).toBe(200);
    expect(capabilities.headers.get('cache-control')).toBe('private, no-store');
    expect(badges.capabilities).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: 'Uid',
        subject: { roles: ['admin'] },
      })
    );
    expect(
      (await request(`admin/profile-badges/${publicProfileId}?after=20`)).status
    ).toBe(200);
    expect(badges.administer).toHaveBeenCalledWith(
      publicProfileId,
      20,
      expect.objectContaining({ identityId: 'Uid' })
    );
    const input = {
      expectedRevision: 0,
      kind: 'verified',
      action: 'award',
      reason: 'Evidence reviewed',
    };
    expect(
      (
        await request(`admin/profile-badges/${publicProfileId}`, 'PUT', input, {
          ...trusted,
          'idempotency-key': 'exact-key',
        })
      ).status
    ).toBe(200);
    expect(badges.change).toHaveBeenCalledWith(
      publicProfileId,
      input,
      'exact-key',
      expect.objectContaining({
        identityId: 'Uid',
        subject: { roles: ['admin'] },
      })
    );
    expect((await request('me/badges')).status).toBe(200);
    expect(badges.own).toHaveBeenCalledWith(
      expect.objectContaining({ identityId: 'Uid' })
    );
    const shared = await request(
      `profiles/${publicProfileId}/badges`,
      'GET',
      undefined,
      { 'x-ingress-auth': 'test-ingress', 'x-anonymous': 'true' }
    );
    expect(shared.status).toBe(200);
    expect(shared.headers.get('vary')).toBe('Authorization');
    expect(shared.headers.get('cache-control')).toBe('private, no-store');
    expect(badges.shared).toHaveBeenCalledWith(publicProfileId, null);
  });
  it.each([
    'after=0',
    'after=-1',
    'after=1&after=2',
    'after=9007199254740992',
    'after=1.2',
    'ownerId=Other',
    'tenantId=Other',
  ])('rejects malformed staff badge query %s', async (query) => {
    expect(
      (await request(`admin/profile-badges/${publicProfileId}?${query}`)).status
    ).toBe(400);
    expect(badges.administer).not.toHaveBeenCalled();
  });
  it('requires authentication for staff/own badges and rejects scope injection on public badge reads', async () => {
    const anonymous = {
      'x-ingress-auth': 'test-ingress',
      'x-anonymous': 'true',
    };
    expect(
      (await request('admin/profile-badges', 'GET', undefined, anonymous))
        .status
    ).toBe(401);
    expect(
      (await request('me/badges', 'GET', undefined, anonymous)).status
    ).toBe(401);
    expect(
      (await request(`profiles/${publicProfileId}/badges?viewer=Other`)).status
    ).toBe(400);
    expect(badges.shared).not.toHaveBeenCalled();
  });
  it('binds shared discussions to the actual viewer and keeps opaque continuations with no public caching', async () => {
    const after = 'v1.' + 'a'.repeat(100);
    const response = await request(
      `profiles/${publicProfileId}/discussions?after=${after}`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(publicDiscussions.read).toHaveBeenCalledWith(
      publicProfileId,
      'Uid',
      after
    );
    expect(
      (
        await request(
          `profiles/${publicProfileId}/discussions`,
          'GET',
          undefined,
          { 'x-ingress-auth': 'test-ingress', 'x-anonymous': 'true' }
        )
      ).status
    ).toBe(200);
    expect(publicDiscussions.read).toHaveBeenLastCalledWith(
      publicProfileId,
      null,
      null
    );
  });
  it.each([
    'ownerIdentityId=Other',
    'tenantId=private',
    'after=x&after=y',
    'after=',
    'after[x]=value',
  ])(
    'rejects injected or malformed shared discussion query %s',
    async (query) => {
      expect(
        (await request(`profiles/${publicProfileId}/discussions?${query}`))
          .status
      ).toBe(400);
      expect(publicDiscussions.read).not.toHaveBeenCalled();
    }
  );
  it('binds shared article reads to the route and actual viewer with protected response caching', async () => {
    const response = await request(
      `profiles/${publicProfileId}/articles?after=${publicProfileId}`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(publicArticles.read).toHaveBeenCalledWith(
      publicProfileId,
      'Uid',
      publicProfileId
    );
    const anonymous = await request(
      `profiles/${publicProfileId}/articles`,
      'GET',
      undefined,
      { 'x-ingress-auth': 'test-ingress', 'x-anonymous': 'true' }
    );
    expect(anonymous.status).toBe(200);
    expect(publicArticles.read).toHaveBeenLastCalledWith(
      publicProfileId,
      null,
      null
    );
  });
  it.each([
    'ownerIdentityId=Other',
    'tenantId=private',
    'page=2',
    `after=${publicProfileId}&after=${publicProfileId}`,
    'after=',
    'after[x]=value',
  ])(
    'rejects malformed public-article query %s before use-case lookup',
    async (query) => {
      expect(
        (await request(`profiles/${publicProfileId}/articles?${query}`)).status
      ).toBe(400);
      expect(publicArticles.read).not.toHaveBeenCalled();
    }
  );
  it('binds shared suite reads to the route and actual viewer with protected response caching', async () => {
    const response = await request(
      `profiles/${publicProfileId}/suites?after=${publicProfileId}`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(publicSuites.read).toHaveBeenCalledWith(
      publicProfileId,
      'Uid',
      publicProfileId
    );
    const anonymous = await request(
      `profiles/${publicProfileId}/suites`,
      'GET',
      undefined,
      { 'x-ingress-auth': 'test-ingress', 'x-anonymous': 'true' }
    );
    expect(anonymous.status).toBe(200);
    expect(publicSuites.read).toHaveBeenLastCalledWith(
      publicProfileId,
      null,
      null
    );
  });
  it.each([
    'ownerIdentityId=Other',
    'tenantId=private',
    'page=2',
    `after=${publicProfileId}&after=${publicProfileId}`,
    'after=',
    'after[x]=value',
  ])(
    'rejects malformed public-suite query %s before use-case lookup',
    async (query) => {
      expect(
        (await request(`profiles/${publicProfileId}/suites?${query}`)).status
      ).toBe(400);
      expect(publicSuites.read).not.toHaveBeenCalled();
    }
  );
  it('binds public favorites to the route and trusted viewer, with no shared caching', async () => {
    const cursor = `applications:${publicProfileId}`;
    const response = await request(
      `profiles/${publicProfileId}/favorites?after=${encodeURIComponent(
        cursor
      )}`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(publicFavorites.read).toHaveBeenCalledWith(
      publicProfileId,
      'Uid',
      cursor
    );
    const anonymous = await request(
      `profiles/${publicProfileId}/favorites`,
      'GET',
      undefined,
      {
        'x-ingress-auth': 'test-ingress',
        'x-anonymous': 'true',
      }
    );
    expect(anonymous.status).toBe(200);
    expect(await anonymous.json()).toEqual({
      sharing: 'hidden',
      items: [],
      after: null,
    });
    expect(publicFavorites.read).toHaveBeenLastCalledWith(
      publicProfileId,
      null,
      null
    );
  });
  it.each([
    'identityId=Other',
    'limit=200',
    'after=x&after=y',
    'after[x]=y',
    'after=',
    `after=${'x'.repeat(65)}`,
  ])(
    'rejects injected or malformed shared-favorites queries before the use case: %s',
    async (query) => {
      expect(
        (await request(`profiles/${publicProfileId}/favorites?${query}`)).status
      ).toBe(400);
      expect(publicFavorites.read).not.toHaveBeenCalled();
    }
  );
  const favoriteChange = {
    expectedRevision: 2,
    saved: true,
    target: {
      kind: 'applications',
      id: '019a0010-0000-7000-8000-000000000001',
    },
  };
  it('reads and changes canonical favorites as the trusted actor', async () => {
    const read = await request('me/favorites');
    expect(read.status).toBe(200);
    expect(read.headers.get('cache-control')).toBe('no-store');
    expect(await read.json()).toEqual({
      identityId: 'Uid',
      revision: 2,
      favorites: [],
    });
    const update = await request('me/favorites', 'PUT', favoriteChange, {
      ...trusted,
      'idempotency-key': 'favorite-key',
    });
    expect(update.status).toBe(200);
    expect(await update.json()).toEqual({ identityId: 'Uid', revision: 3 });
    expect(favorites.change).toHaveBeenCalledWith(
      'Uid',
      favoriteChange,
      'favorite-key',
      { version: 1, at: 100 }
    );
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'identity.favorites.update',
        resource: { type: 'user', id: 'Uid' },
      })
    );
  });
  it.each([
    { ...favoriteChange, identityId: 'Other' },
    { ...favoriteChange, expectedRevision: '2' },
    { ...favoriteChange, saved: 'false' },
    { ...favoriteChange, target: { kind: 'applications', id: 'slug' } },
    { ...favoriteChange, target: { ...favoriteChange.target, name: 'Copied' } },
  ])(
    'rejects malformed/injected favorites before mutation: %j',
    async (body) => {
      expect(
        (
          await request('me/favorites', 'PUT', body, {
            ...trusted,
            'idempotency-key': 'key',
          })
        ).status
      ).toBe(400);
      expect(favorites.change).not.toHaveBeenCalled();
      expect(favoriteTargets.available).not.toHaveBeenCalled();
    }
  );
  it('requires a favorite key and authentication, and exposes conflict/target absence truthfully', async () => {
    expect((await request('me/favorites', 'GET', undefined, {})).status).toBe(
      401
    );
    expect((await request('me/favorites', 'PUT', favoriteChange)).status).toBe(
      400
    );
    favorites.inspectChange.mockRejectedValueOnce(
      new CanonicalIdentityConflict('revision changed')
    );
    expect(
      (
        await request('me/favorites', 'PUT', favoriteChange, {
          ...trusted,
          'idempotency-key': 'key',
        })
      ).status
    ).toBe(409);
    favoriteTargets.available.mockResolvedValue(false);
    expect(
      (
        await request('me/favorites', 'PUT', favoriteChange, {
          ...trusted,
          'idempotency-key': 'key',
        })
      ).status
    ).toBe(400);
    expect(favorites.change).not.toHaveBeenCalled();
  });
  it('denies favorites policy failures before storage or target reads', async () => {
    for (const [decision, status] of [
      [ok(false), 403],
      [err(new Error('OPA')), 503],
    ] as const) {
      validate.mockResolvedValue(decision);
      expect((await request('me/favorites')).status).toBe(status);
      expect(
        (
          await request('me/favorites', 'PUT', favoriteChange, {
            ...trusted,
            'idempotency-key': 'key',
          })
        ).status
      ).toBe(status);
    }
    expect(favorites.read).not.toHaveBeenCalled();
    expect(favorites.inspectChange).not.toHaveBeenCalled();
    expect(favorites.change).not.toHaveBeenCalled();
    expect(favoriteTargets.available).not.toHaveBeenCalled();
  });
  it('reads and changes only the trusted actor preferences through self policy', async () => {
    const read = await request('me/preferences');
    expect(read.status).toBe(200);
    expect(read.headers.get('cache-control')).toBe('no-store');
    expect(await read.json()).toMatchObject({
      identityId: 'Uid',
      updatedAt: null,
      preferences: { privacy: { profileVisibility: 'private' } },
    });
    const response = await request('me/preferences', 'PUT', preferencesUpdate, {
      ...trusted,
      'idempotency-key': 'prefs-key',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ identityId: 'Uid', revision: 3 });
    expect(identities.updatePreferences).toHaveBeenCalledWith(
      'Uid',
      preferencesUpdate,
      'prefs-key'
    );
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'identity.preferences.update',
        identityId: 'Uid',
        resource: { type: 'user', id: 'Uid' },
      })
    );
  });
  it.each([
    { ...preferencesUpdate, identityId: 'Other' },
    { ...preferencesUpdate, expectedRevision: '2' },
    { ...preferencesUpdate, preferences: {} },
    {
      ...preferencesUpdate,
      preferences: {
        ...preferencesUpdate.preferences,
        privacy: {
          ...preferencesUpdate.preferences.privacy,
          profileVisibility: 'friends',
        },
      },
    },
    {
      ...preferencesUpdate,
      preferences: {
        ...preferencesUpdate.preferences,
        display: {
          ...preferencesUpdate.preferences.display,
          itemsPerPage: 9999,
        },
      },
    },
  ])('rejects malformed preferences without writes: %j', async (body) => {
    expect(
      (
        await request('me/preferences', 'PUT', body, {
          ...trusted,
          'idempotency-key': 'key',
        })
      ).status
    ).toBe(400);
    expect(identities.updatePreferences).not.toHaveBeenCalled();
  });
  it('requires authentication and a preferences command key, and preserves conflicts', async () => {
    expect((await request('me/preferences', 'GET', undefined, {})).status).toBe(
      401
    );
    expect(
      (await request('me/preferences', 'PUT', preferencesUpdate)).status
    ).toBe(400);
    identities.updatePreferences.mockRejectedValue(
      new CanonicalIdentityConflict('stale')
    );
    expect(
      (
        await request('me/preferences', 'PUT', preferencesUpdate, {
          ...trusted,
          'idempotency-key': 'key',
        })
      ).status
    ).toBe(409);
  });
  it('fails closed before preferences storage on policy denial and outage', async () => {
    for (const [decision, status] of [
      [ok(false), 403],
      [err(new Error('unavailable')), 503],
    ] as const) {
      validate.mockResolvedValue(decision);
      expect((await request('me/preferences')).status).toBe(status);
      expect(
        (
          await request('me/preferences', 'PUT', preferencesUpdate, {
            ...trusted,
            'idempotency-key': 'key',
          })
        ).status
      ).toBe(status);
    }
    expect(identities.getPreferences).not.toHaveBeenCalled();
    expect(identities.updatePreferences).not.toHaveBeenCalled();
  });

  const profileUpdate = {
    name: 'Alice',
    bio: null,
    location: null,
    socialLinks: { github: '@alice' },
    expectedRevision: 2,
  };
  it('binds profile editing to trusted identity with an explicit self policy and no cache', async () => {
    const result = await request('me/profile', 'PUT', profileUpdate, {
      ...trusted,
      'idempotency-key': 'edit-1',
    });
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(await result.json()).toEqual({ identityId: 'Uid', revision: 3 });
    expect(identities.updateProfile).toHaveBeenCalledWith(
      'Uid',
      profileUpdate,
      'edit-1'
    );
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'identity.profile.update',
        resource: { type: 'user', id: 'Uid' },
      })
    );
  });
  it('reads canonical private profile through policy', async () => {
    const result = await request('me/profile');
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(await result.json()).toMatchObject({
      identityId: 'Uid',
      revision: 2,
    });
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({ actionName: 'identity.profile.read' })
    );
  });
  it.each([
    { ...profileUpdate, identityId: 'Other' },
    { ...profileUpdate, avatarUri: 'data:image/png;base64,eA==' },
    { ...profileUpdate, expectedRevision: '2' },
    { ...profileUpdate, socialLinks: { admin: true } },
    { ...profileUpdate, socialLinks: { website: 'javascript:alert(1)' } },
    { ...profileUpdate, bio: undefined },
  ])('rejects invalid profile requests: %j', async (body) => {
    expect(
      (
        await request('me/profile', 'PUT', body, {
          ...trusted,
          'idempotency-key': 'edit',
        })
      ).status
    ).toBe(400);
    expect(identities.updateProfile).not.toHaveBeenCalled();
  });
  it('requires a profile command key and reports optimistic conflicts', async () => {
    expect((await request('me/profile', 'PUT', profileUpdate)).status).toBe(
      400
    );
    identities.updateProfile.mockRejectedValue(
      new CanonicalIdentityConflict('revision changed')
    );
    expect(
      (
        await request('me/profile', 'PUT', profileUpdate, {
          ...trusted,
          'idempotency-key': 'edit',
        })
      ).status
    ).toBe(409);
  });
  it('does not read or mutate profiles after policy denial or outage', async () => {
    for (const [decision, status] of [
      [ok(false), 403],
      [err(new Error('OPA')), 503],
    ] as const) {
      validate.mockResolvedValue(decision);
      expect((await request('me/profile')).status).toBe(status);
      expect(
        (
          await request('me/profile', 'PUT', profileUpdate, {
            ...trusted,
            'idempotency-key': 'edit',
          })
        ).status
      ).toBe(status);
    }
    expect(identities.getProfile).not.toHaveBeenCalled();
    expect(identities.updateProfile).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([
    {},
    { 'x-user-id': 'Uid' },
    { ...trusted, 'x-ingress-auth': 'wrong' },
    { ...trusted, 'x-anonymous': 'true' },
  ])('rejects untrusted/anonymous protected requests: %j', async (headers) => {
    expect((await request('me', 'GET', undefined, headers)).status).toBe(401);
    expect(accounts.account).not.toHaveBeenCalled();
  });
  it.each(['{', 'null', '[]', '{"roles":"admin"}', '{"roles":[1]}'])(
    'rejects malformed claims: %s',
    async (claims) => {
      expect(
        (
          await request('me', 'GET', undefined, {
            ...trusted,
            'x-user-claims': claims,
          })
        ).status
      ).toBe(400);
      expect(accounts.account).not.toHaveBeenCalled();
    }
  );
  it.each([
    { isSuspended: true },
    { isDeleted: true },
    { isActive: false },
    { identityId: 'Other' },
  ])('checks current authority on each request: %j', async (patch) => {
    identities.find.mockResolvedValue({ ...state, ...patch });
    expect((await request('me')).status).toBe(401);
    expect(accounts.account).not.toHaveBeenCalled();
  });
  it('reports lifecycle lookup outages instead of granting access', async () => {
    identities.find.mockRejectedValue(new Error('private SQL diagnostic'));
    const result = await request('me');
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain('private SQL');
  });
  it('returns canonical UID and an honest unregistered state', async () => {
    const result = await request('me');
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      uid: 'Uid',
      identityId: 'Uid',
      revision: 1,
      account: { status: 'STUB' },
      profile: { name: null },
    });
    expect(identities.ensure).not.toHaveBeenCalled();
  });
  it('binds registration to the trusted actor, expected revision and idempotency key', async () => {
    const result = await request(
      'registration/complete',
      'POST',
      { name: 'Alice', expectedRevision: 1 },
      { ...trusted, 'idempotency-key': 'command-1' }
    );
    expect(result.status).toBe(200);
    expect(accounts.completeRegistration).toHaveBeenCalledWith(
      'Uid',
      {
        name: 'Alice',
        expectedRevision: 1,
        bio: null,
        location: null,
        avatarUri: null,
      },
      'command-1'
    );
  });
  it.each([
    { name: 'Alice' },
    { name: 'Alice', expectedRevision: '1' },
    { name: ' ', expectedRevision: 1 },
    { name: 'Alice', expectedRevision: 1, identityId: 'Other' },
  ])('rejects malformed registration: %j', async (body) => {
    expect(
      (
        await request('registration/complete', 'POST', body, {
          ...trusted,
          'idempotency-key': 'command-1',
        })
      ).status
    ).toBe(400);
    expect(accounts.completeRegistration).not.toHaveBeenCalled();
  });
  it('requires a command key', async () => {
    expect(
      (
        await request('registration/complete', 'POST', {
          name: 'Alice',
          expectedRevision: 1,
        })
      ).status
    ).toBe(400);
    expect(accounts.completeRegistration).not.toHaveBeenCalled();
  });
  it('exposes optimistic concurrency as a conflict', async () => {
    accounts.completeRegistration.mockRejectedValue(
      new CanonicalIdentityConflict('Identity revision changed')
    );
    expect(
      (
        await request(
          'registration/complete',
          'POST',
          { name: 'Alice', expectedRevision: 1 },
          { ...trusted, 'idempotency-key': 'command-1' }
        )
      ).status
    ).toBe(409);
  });
  it('acknowledges deletion only after the canonical tombstone commit', async () => {
    const result = await request('me', 'DELETE');
    expect(result.status).toBe(202);
    expect(await result.json()).toEqual({
      identityId: 'Uid',
      revision: 2,
      status: 'accepted',
      cleanup: 'pending',
    });
    expect(identities.requestDeletion).toHaveBeenCalledWith('Uid');
    expect(credentials.deleteUser).not.toHaveBeenCalled();
  });
  it('does not return fake deletion success after a failed transaction', async () => {
    identities.requestDeletion.mockRejectedValue(new Error('SQL'));
    expect((await request('me', 'DELETE')).status).toBe(503);
  });
  it.each(['disable', 'enable', 'revoke-tokens'])(
    'requires successful explicit policy for %s',
    async (action) => {
      validate.mockResolvedValue(ok(false));
      expect(
        (await request(`admin/users/target/${action}`, 'POST')).status
      ).toBe(403);
      expect(identities.setSuspended).not.toHaveBeenCalled();
      expect(credentials.revokeRefreshTokens).not.toHaveBeenCalled();
    }
  );
  it('fails closed on an unavailable policy service', async () => {
    validate.mockResolvedValue(err(new Error('OPA')));
    expect((await request('admin/users/target', 'DELETE')).status).toBe(503);
    expect(identities.requestDeletion).not.toHaveBeenCalled();
  });
  it('suspends canonical application access without provisioning a target', async () => {
    expect((await request('admin/users/target/disable', 'POST')).status).toBe(
      201
    );
    expect(identities.setSuspended).toHaveBeenCalledWith('target', true);
    expect(credentials.updateUser).not.toHaveBeenCalled();
    expect(identities.ensure).not.toHaveBeenCalled();
  });
  it('admin deletion uses the same accepted cleanup contract', async () => {
    const result = await request('admin/users/Uid', 'DELETE');
    expect(result.status).toBe(202);
    expect(await result.json()).toMatchObject({
      status: 'accepted',
      cleanup: 'pending',
    });
    expect(credentials.deleteUser).not.toHaveBeenCalled();
  });
  it('allows password recovery without requiring a session', async () => {
    const result = await request(
      'password-recovery',
      'POST',
      { email: 'alice@example.com' },
      {}
    );
    expect(result.status).toBe(202);
    expect(await result.json()).toEqual({ accepted: true });
    expect(recovery.send).toHaveBeenCalledWith('alice@example.com');
    expect(identities.find).not.toHaveBeenCalled();
  });
  it('does not pretend provider delivery succeeded during an outage', async () => {
    recovery.send.mockRejectedValue(new Error('upstream'));
    expect(
      (
        await request(
          'password-recovery',
          'POST',
          { email: 'alice@example.com' },
          {}
        )
      ).status
    ).toBe(503);
  });
  it('rejects invalid recovery input without calling the provider', async () => {
    expect(
      (
        await request(
          'password-recovery',
          'POST',
          { email: 'invalid', exposeLink: true },
          {}
        )
      ).status
    ).toBe(400);
    expect(recovery.send).not.toHaveBeenCalled();
  });
});
