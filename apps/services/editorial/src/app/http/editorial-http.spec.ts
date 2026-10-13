import { ArticleCatalog } from '../articles/article-catalog';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { err, ok } from '@sdk/kernel/standard';
import { AppModule } from '../app.module';
import { MysqlEditorialWrites } from '../infrastructure/mysql-editorial-writes';
import { MysqlEditorialReads } from '../infrastructure/mysql-editorial-reads';
import { OpaEditorialPolicy } from '../infrastructure/opa-editorial-policy';
import { EditorialOutboxDispatcher } from '../infrastructure/editorial-outbox.dispatcher';
import { SuiteCatalog } from '../suites/suite-catalog';
import {
  EditorialMutation,
  EditorialResourceKind,
  EditorialWrites,
} from '../application/editorial.ports';

describe('Editorial production module HTTP authorization', () => {
  const id = '019a0010-0000-7000-8000-000000000001';
  const evaluate = jest.fn();
  const writes: jest.Mocked<EditorialWrites> = {
    resource: jest.fn(),
    receipt: jest.fn(),
    commit: jest.fn(),
  };
  const reads = { list: jest.fn(), find: jest.fn() };
  const profileCatalog = { profile: jest.fn() };
  let app: INestApplication;
  let origin: string;

  beforeAll(async () => {
    const values: Record<string, string> = {
      INGRESS_AUTH_SECRET: 'test-ingress',
      EDITORIAL_PUBLIC_TENANT: 'default',
      EDITORIAL_SEED_DEMO_DATA: 'false',
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EditorialOutboxDispatcher)
      .useValue({})
      .overrideProvider(ConfigService)
      .useValue({ get: (key: string) => values[key] })
      .overrideProvider(DataSource)
      .useValue({
        options: { type: 'mysql' },
        entityMetadatas: [],
        getRepository: () => ({}),
      })
      .overrideProvider(MysqlEditorialWrites)
      .useValue(writes)
      .overrideProvider(MysqlEditorialReads)
      .useValue(reads)
      .overrideProvider(OpaEditorialPolicy)
      .useValue({ evaluate })
      .overrideProvider(ArticleCatalog)
      .useValue(profileCatalog)
      .overrideProvider(SuiteCatalog)
      .useValue(profileCatalog)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    evaluate.mockResolvedValue(ok(true));
    writes.resource.mockImplementation(async (kind: EditorialResourceKind) => ({
      kind,
      id,
      revision: 1,
      ownerIdentityId: 'owner',
      tenantId: 'default',
      deletedAt: null,
    }));
    writes.receipt.mockResolvedValue(null);
    writes.commit.mockImplementation(async (value: EditorialMutation) => ({
      id: value.id,
      kind: value.kind,
      revision: value.type === 'create' ? 1 : 2,
      deleted: value.type === 'delete',
      projection: 'pending',
    }));
    reads.list.mockResolvedValue([]);
    reads.find.mockResolvedValue(null);
    profileCatalog.profile.mockResolvedValue({
      sharing: 'visible',
      items: [],
      after: null,
    });
  });
  it('composes the article collection with dedicated authorization and no-store', async () => {
    const response = await request(
      'internal/profile-articles',
      'POST',
      { ownerIdentityId: 'OwnerUid', after: null },
      { 'x-profile-reader': 'test-ingress' }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(profileCatalog.profile).toHaveBeenCalledWith('OwnerUid', null);
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'editorial.profile.articles.read',
        resource: {
          type: 'profile-article-collection',
          id: 'OwnerUid',
          tenantId: 'default',
        },
      })
    );
  });
  it('allows only the scoped service credential to select an owner public collection', async () => {
    const response = await request(
      'internal/profile-suites',
      'POST',
      { ownerIdentityId: 'OwnerUid', after: null },
      { 'x-profile-reader': 'test-ingress' }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({
      sharing: 'visible',
      items: [],
      after: null,
    });
    expect(profileCatalog.profile).toHaveBeenCalledWith('OwnerUid', null);
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: 'wapps-profile-reader',
        actionName: 'editorial.profile.suites.read',
        resource: {
          type: 'profile-suite-collection',
          id: 'OwnerUid',
          tenantId: 'default',
        },
      })
    );
  });
  it.each<Record<string, string>>([
    {},
    { 'x-profile-reader': 'wrong' },
    { 'x-user-id': 'owner', 'x-ingress-auth': 'test-ingress' },
    { 'x-profile-reader': 'test-ingress', 'x-user-id': 'owner' },
    { 'x-profile-reader': 'test-ingress', authorization: 'Bearer token' },
  ])(
    'denies public/member/mixed credentials before querying an owner: %j',
    async (auth) => {
      expect(
        (
          await request(
            'internal/profile-suites',
            'POST',
            { ownerIdentityId: 'OwnerUid', after: null },
            auth
          )
        ).status
      ).toBe(401);
      expect(profileCatalog.profile).not.toHaveBeenCalled();
      expect(evaluate).not.toHaveBeenCalled();
    }
  );
  it('never authorizes ordinary editorial writes using the profile service credential', async () => {
    expect(
      (
        await request(
          'apps',
          'POST',
          { name: 'App', slug: 'app' },
          { 'x-profile-reader': 'test-ingress' }
        )
      ).status
    ).toBe(401);
    expect(writes.commit).not.toHaveBeenCalled();
  });
  it('rejects injected owner scope, duplicate credential and failed policy before reading content', async () => {
    const credential = { 'x-profile-reader': 'test-ingress' };
    expect(
      (
        await request(
          'internal/profile-suites?tenantId=private',
          'POST',
          { ownerIdentityId: 'OwnerUid', after: null },
          credential
        )
      ).status
    ).toBe(400);
    expect(
      (
        await request(
          'internal/profile-suites',
          'POST',
          { ownerIdentityId: 'OwnerUid', after: null, tenantId: 'private' },
          credential
        )
      ).status
    ).toBe(400);
    expect(
      (
        await request(
          'internal/profile-suites',
          'POST',
          { ownerIdentityId: 'OwnerUid', after: null },
          {
            'x-profile-reader': 'test-ingress',
            'X-Profile-Reader': 'test-ingress',
          }
        )
      ).status
    ).toBe(401);
    for (const [decision, status] of [
      [ok(false), 403],
      [err(new Error('policy')), 503],
    ] as const) {
      evaluate.mockResolvedValue(decision);
      expect(
        (
          await request(
            'internal/profile-suites',
            'POST',
            { ownerIdentityId: 'OwnerUid', after: null },
            credential
          )
        ).status
      ).toBe(status);
    }
    expect(profileCatalog.profile).not.toHaveBeenCalled();
  });
  afterAll(async () => {
    await app?.close();
  });

  function headers(
    user = 'owner',
    tenantId = 'default',
    roles = ['editorial:publisher', 'editorial:taxonomy']
  ) {
    return {
      'x-user-id': user,
      'x-user-claims': JSON.stringify({ tenantId, roles }),
      'x-ingress-auth': 'test-ingress',
    };
  }
  function request(
    path: string,
    method = 'POST',
    body: unknown = { name: 'Name', slug: 'name' },
    auth: Record<string, string> = {}
  ) {
    return fetch(`${origin}/api/${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'http-key',
        ...auth,
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    });
  }

  it.each(['apps', 'categories', 'tags'])(
    'rejects every anonymous %s mutation',
    async (path) => {
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const response = await request(
          method === 'POST' ? path : `${path}/${id}`,
          method
        );
        expect(response.status).toBe(401);
      }
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );

  it.each(['apps', 'categories', 'tags'])(
    'rejects spoofed identity headers on %s',
    async (path) => {
      expect(
        (
          await request(path, 'POST', undefined, {
            ...headers(),
            'x-ingress-auth': 'forged',
          })
        ).status
      ).toBe(401);
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );

  it.each(['apps', 'categories', 'tags'])(
    'enforces explicit policy denial and outages on %s',
    async (path) => {
      evaluate.mockResolvedValue(ok(false));
      expect(
        (await request(path, 'POST', { name: 'Name', slug: 'name' }, headers()))
          .status
      ).toBe(403);
      evaluate.mockResolvedValue(err(new Error('OPA down')));
      expect(
        (await request(path, 'POST', { name: 'Name', slug: 'name' }, headers()))
          .status
      ).toBe(503);
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );

  it('rejects cross-owner and cross-tenant mutations despite permissive policy', async () => {
    expect(
      (
        await request(
          `apps/${id}`,
          'PUT',
          { name: 'Changed', expectedRevision: 1 },
          headers('other')
        )
      ).status
    ).toBe(403);
    expect(
      (
        await request(
          `apps/${id}`,
          'DELETE',
          { expectedRevision: 1 },
          headers('admin', 'other', ['admin'])
        )
      ).status
    ).toBe(403);
    expect(writes.commit).not.toHaveBeenCalled();
  });

  it('accepts an owner update and a same-tenant moderator deletion', async () => {
    const response = await request(
      `apps/${id}`,
      'PUT',
      { name: 'Changed', expectedRevision: 1 },
      headers()
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id,
      revision: 2,
      projection: 'pending',
    });
    expect(
      (
        await request(
          `apps/${id}`,
          'DELETE',
          { expectedRevision: 1 },
          headers('moderator', 'default', ['editorial:moderator'])
        )
      ).status
    ).toBe(200);
    expect(writes.commit).toHaveBeenCalledTimes(2);
  });

  it('rejects protected fields, missing revisions and malformed actor claims', async () => {
    expect(
      (
        await request(
          'apps',
          'POST',
          { name: 'Name', slug: 'name', ownerIdentityId: 'other' },
          headers()
        )
      ).status
    ).toBe(400);
    expect(
      (await request(`apps/${id}`, 'PUT', { name: 'Changed' }, headers()))
        .status
    ).toBe(400);
    expect(
      (
        await request(
          'apps',
          'POST',
          { name: 'Name', slug: 'name' },
          { ...headers(), 'x-user-claims': '{invalid' }
        )
      ).status
    ).toBe(400);
    expect(writes.commit).not.toHaveBeenCalled();
  });

  it('serves public reads and returns a truthful missing-resource response', async () => {
    expect((await request('apps', 'GET')).status).toBe(200);
    expect(reads.list).toHaveBeenCalledWith('app', 'default');
    expect((await request(`apps/${id}`, 'GET')).status).toBe(404);
  });
});
