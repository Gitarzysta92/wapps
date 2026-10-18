import { Test } from '@nestjs/testing';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { DISCUSSION_PROJECTION_SCHEMA } from '@sdk/features/discussion/core';
import {
  BoundDiscussionQueries,
  DiscussionDiscovery,
  DiscussionQueries,
  DurableDiscussionCommands,
  DiscussionConflictError,
  type DiscussionActor,
  type DiscussionBindings,
  type DiscussionResource,
  type DiscussionWriteRepository,
  type DiscussionProjectionReader,
} from '@sdk/features/discussion/libs/management';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  DiscussionsController,
  DISCUSSION_HTTP_OPTIONS,
  type DiscussionHttpOptions,
} from './index';

const id = '10000000-0000-4000-8000-000000000001';
const created = '10000000-0000-4000-8000-000000000002';
const key = 'NewConsumer|record@v987/a:b?c=2&d=3';
const content = { blocks: [{ format: 'custom', value: [42, true] }] };
const actor: DiscussionActor = {
  identityId: 'Owner',
  tenantId: 'tenant',
  roles: ['admin'],
};

describe('reusable Discussion HTTP capability', () => {
  let app: INestApplication, origin: string;
  let resource: DiscussionResource;
  const writes: jest.Mocked<DiscussionWriteRepository> = {
    resource: jest.fn(),
    resources: jest.fn(),
    receipt: jest.fn(),
    commit: jest.fn(),
  };
  const projections: jest.Mocked<DiscussionProjectionReader> = {
    heads: jest.fn(),
    head: jest.fn(),
    nodes: jest.fn(),
  };
  const bindings: jest.Mocked<DiscussionBindings> = {
    visible: jest.fn(),
    anonymous: jest.fn(),
    content: jest.fn(),
    authorize: jest.fn(),
    context: jest.fn(),
    fingerprintInput: jest.fn(),
  };
  const put = jest.fn(),
    evaluate = jest.fn(),
    index = { list: jest.fn() },
    votes = { read: jest.fn() };
  const membership = { list: jest.fn(), current: jest.fn() },
    authorizeParticipation = jest.fn();
  beforeAll(async () => {
    const unboundQueries = new DiscussionQueries(
      writes,
      projections,
      'tenant',
      bindings
    );
    const queries = new BoundDiscussionQueries(
      unboundQueries,
      writes,
      index,
      bindings,
      'tenant',
      votes
    );
    const options: DiscussionHttpOptions = {
      commands: new DurableDiscussionCommands(
        writes,
        { put },
        { evaluate },
        { generate: () => created },
        bindings
      ),
      queries,
      unboundQueries,
      discovery: new DiscussionDiscovery(
        queries,
        writes,
        bindings,
        membership,
        authorizeParticipation,
        'tenant'
      ),
      actor: (request, required) => {
        if (request.headers.authorization === 'Bearer fixture') return actor;
        if (
          required ||
          request.headers.authorization ||
          request.headers['x-user-id']
        )
          throw new UnauthorizedException();
        return null;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [DiscussionsController],
      providers: [{ provide: DISCUSSION_HTTP_OPTIONS, useValue: options }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    evaluate.mockResolvedValue({ ok: true, value: true });
    resource = {
      id,
      discussionId: id,
      bindingKey: key,
      revision: 2,
      pinned: false,
      tenantId: 'tenant',
      ownerIdentityId: 'Owner',
      rootOwnerIdentityId: 'Owner',
      kind: 'discussion',
      state: 'published',
      rootState: 'published',
      visibility: 'public',
      rootVisibility: 'public',
      deletedAt: null,
      rootDeletedAt: null,
    };
    writes.resource.mockImplementation(async () => ({ ...resource }));
    writes.resources.mockImplementation(async () => [{ ...resource }]);
    writes.receipt.mockResolvedValue(null);
    writes.commit.mockResolvedValue({
      id: created,
      discussionId: id,
      revision: 3,
      projection: 'pending',
    });
    put.mockResolvedValue({ key: 'immutable', sha256: 'hash', bytes: 20 });
    bindings.visible.mockImplementation(
      async (binding, tenant) => binding === key && tenant === 'tenant'
    );
    bindings.content.mockImplementation((_binding, _kind, input) => input);
    bindings.anonymous.mockImplementation((_binding, input) => input);
    bindings.authorize.mockResolvedValue(undefined);
    bindings.context.mockResolvedValue(undefined);
    bindings.fingerprintInput.mockImplementation((input) => input);
    projections.head.mockResolvedValue({
      _id: id,
      schemaVersion: DISCUSSION_PROJECTION_SCHEMA,
      tenantId: 'tenant',
      generation: 'g2',
      fingerprint: 'hash',
      revision: 2,
      subjectId: null,
      subjectReferenceKey: null,
      state: 'published',
      visibility: 'public',
      deletedAt: null,
      createdAt: 10,
      lastActivityAt: 10,
      descendantsCount: 0,
      nodeCount: 1,
      bindingKey: key,
    });
    projections.nodes.mockResolvedValue([
      {
        _id: 'node',
        ...resource,
        referenceKey: id,
        generation: 'g2',
        schemaVersion: DISCUSSION_PROJECTION_SCHEMA,
        parentId: null,
        depth: 0,
        createdAt: 10,
        updatedAt: null,
        likeCount: 0,
        payload: { content },
      },
    ]);
    index.list.mockResolvedValue([{ id, at: 10, pinned: false }]);
    votes.read.mockResolvedValue(
      new Map([[id, { upvotes: 0, downvotes: 0, mine: 0 }]])
    );
    const member = {
      id,
      bindingKey: key,
      revision: 2,
      at: 10,
      participation: 'author',
    };
    membership.list.mockResolvedValue([member]);
    membership.current.mockResolvedValue([member]);
    authorizeParticipation.mockResolvedValue(undefined);
  });
  function request(
    method: string,
    suffix = '',
    body?: unknown,
    query = new URLSearchParams({ bindingKey: key }),
    token: string | null = 'fixture'
  ) {
    return fetch(`${origin}/api/discussions${suffix}?${query}`, {
      method,
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body !== undefined
          ? {
              'content-type': 'application/json',
              'idempotency-key': 'command-1',
            }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  const commands: Array<[string, string, unknown]> = [
    ['POST', '', { content }],
    ['POST', '/' + id + '/comments', { content }],
    ['PUT', '/' + id, { content, expectedRevision: 2 }],
    ['DELETE', '/' + id, { expectedRevision: 2 }],
    ['PUT', '/' + id + '/vote', { value: -1, expectedRevision: 2 }],
    ['PUT', '/' + id + '/pin', { pinned: true, expectedRevision: 2 }],
  ];
  it.each(commands)(
    'executes %s %s with an unfamiliar opaque key and consumer payload',
    async (method, suffix, body) => {
      const response = await request(method, suffix, body);
      expect(response.status).toBe(method === 'POST' ? 201 : 200);
      expect(writes.commit).toHaveBeenCalledTimes(1);
      expect(bindings.authorize.mock.calls[0].slice(0, 2)).toEqual([
        key,
        actor,
      ]);
    }
  );
  it.each(commands)(
    'requires authentication for %s %s',
    async (method, suffix, body) => {
      expect(
        (await request(method, suffix, body, undefined, null)).status
      ).toBe(401);
      expect(writes.commit).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
    }
  );
  it.each(commands)(
    'fails closed on consumer denial for %s %s',
    async (method, suffix, body) => {
      bindings.authorize.mockRejectedValue(
        new PermissionDeniedError('consumer.denied')
      );
      expect((await request(method, suffix, body)).status).toBe(403);
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );
  it.each([key.toLowerCase(), 'other|binding'])(
    'isolates a different key %s',
    async (bindingKey) => {
      expect(
        (
          await request(
            'GET',
            '/' + id,
            undefined,
            new URLSearchParams({ bindingKey })
          )
        ).status
      ).toBe(404);
      expect(
        (
          await request(
            'PUT',
            '/' + id,
            { content, expectedRevision: 2 },
            new URLSearchParams({ bindingKey })
          )
        ).status
      ).toBe(404);
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );
  it('returns consumer content without a built-in kind or schema version', async () => {
    const response = await request('GET', '/' + id, undefined, undefined, null);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id,
      bindingKey: key,
      comments: [{ content, editable: false, removable: false }],
    });
  });
  it('returns owner permissions and current votes independently of payload shape', async () => {
    const response = await request(
      'GET',
      '/' + id,
      undefined,
      new URLSearchParams({ bindingKey: key, includeVotes: 'true' })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      canPin: true,
      comments: [
        {
          editable: true,
          removable: true,
          votes: { upvotes: 0, downvotes: 0, mine: 0 },
        },
      ],
    });
  });
  it('pages through the generic canonical index', async () => {
    const response = await request('GET');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [{ id, bindingKey: key }],
      next: null,
    });
    expect(index.list).toHaveBeenCalledWith(
      'tenant',
      key,
      actor,
      null,
      'created'
    );
  });
  it('resolves generic participation and public selection', async () => {
    for (const suffix of ['/participation', '/selection']) {
      const response = await request(
        'GET',
        suffix,
        undefined,
        new URLSearchParams({
          bindingPrefix: 'NewConsumer|',
          ...(suffix === '/selection' ? { ids: id } : {}),
        })
      );
      expect(response.status).toBe(200);
      expect((await response.json()).items).toHaveLength(1);
    }
    expect(authorizeParticipation).toHaveBeenCalledWith(actor);
  });
  it('omits withdrawn parents from discovery and denies direct reads/writes', async () => {
    bindings.visible.mockResolvedValue(false);
    expect((await request('GET', '/' + id)).status).toBe(404);
    expect((await request('POST', '', { content })).status).toBe(404);
    const response = await request(
      'GET',
      '/selection',
      undefined,
      new URLSearchParams({ bindingPrefix: 'NewConsumer|', ids: id })
    );
    expect(await response.json()).toEqual({ items: [] });
  });
  it('rechecks canonical visibility after external parent I/O', async () => {
    let calls = 0;
    bindings.visible.mockImplementation(async () => {
      if (++calls === 3) resource = { ...resource, rootDeletedAt: 20 };
      return true;
    });
    expect((await request('GET', '/' + id)).status).toBe(404);
  });
  it('returns projection pending when authority advances during a vote read', async () => {
    votes.read.mockImplementation(async () => {
      resource.revision = 3;
      return new Map([[id, { upvotes: 0, downvotes: 0, mine: 0 }]]);
    });
    const response = await request(
      'GET',
      '/' + id,
      undefined,
      new URLSearchParams({ bindingKey: key, includeVotes: 'true' })
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('2');
  });
  it('preserves a receipt and fails conflicts without another write', async () => {
    writes.receipt.mockResolvedValue({
      id: created,
      discussionId: created,
      revision: 1,
      projection: 'pending',
    });
    expect((await request('POST', '', { content })).status).toBe(201);
    expect(writes.commit).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    writes.receipt.mockRejectedValue(
      new DiscussionConflictError('Conflicting receipt')
    );
    expect((await request('POST', '', { content })).status).toBe(409);
  });
  it.each(['', 'has spaces', 'x'.repeat(257)])(
    'rejects invalid binding %s',
    async (bindingKey) => {
      expect(
        (
          await request(
            'GET',
            '',
            undefined,
            new URLSearchParams({ bindingKey })
          )
        ).status
      ).toBe(400);
    }
  );
  it.each([
    'bindingKey=',
    'bindingKey=one&bindingKey=two',
    'bindingKey[]=one',
    'bindingKey[context]=one',
    'bindingPrefix=one',
    'rootOnly=true',
    'order=pinned',
    'cursor=10.' + id,
    'includeVotes=true',
  ])(
    'rejects malformed or incomplete scope without an unbound fallback: %s',
    async (query) => {
      const response = await request(
        'POST',
        '',
        { content },
        new URLSearchParams(query)
      );
      expect(response.status).toBe(400);
      expect(put).not.toHaveBeenCalled();
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );

  async function makeUnbound() {
    resource = { ...resource, bindingKey: null };
    const head = await projections.head(id);
    if (!head) throw new Error('Missing fixture head');
    const unboundHead = { ...head };
    delete unboundHead.bindingKey;
    projections.head.mockResolvedValue(unboundHead);
    projections.heads.mockResolvedValue([unboundHead]);
    projections.nodes.mockResolvedValue(
      (await projections.nodes('g2')).map((node) => ({
        ...node,
        bindingKey: null,
      }))
    );
    return unboundHead;
  }

  it('preserves unbound list and detail representations on the same controller', async () => {
    const head = await makeUnbound();
    const list = await request('GET', '', undefined, new URLSearchParams());
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([head]);
    const detail = await request(
      'GET',
      '/' + id,
      undefined,
      new URLSearchParams()
    );
    expect(detail.status).toBe(200);
    expect(await detail.json()).toEqual({
      aggregate: head,
      nodes: await projections.nodes('g2'),
    });
    expect(bindings.visible).not.toHaveBeenCalled();
    expect(index.list).not.toHaveBeenCalled();
  });

  const unboundCommands = commands.slice(0, 4);
  it.each(unboundCommands)(
    'retains unbound %s %s commands',
    async (method, suffix, body) => {
      await makeUnbound();
      expect(
        (await request(method, suffix, body, new URLSearchParams())).status
      ).toBe(method === 'POST' ? 201 : 200);
      expect(writes.commit).toHaveBeenCalledTimes(1);
      expect(bindings.authorize).not.toHaveBeenCalled();
    }
  );
  it.each(unboundCommands)(
    'enforces policy denial on unbound %s %s',
    async (method, suffix, body) => {
      await makeUnbound();
      evaluate.mockResolvedValue({ ok: true, value: false });
      expect(
        (await request(method, suffix, body, new URLSearchParams())).status
      ).toBe(403);
      expect(writes.commit).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
    }
  );
  it.each(unboundCommands)(
    'requires identity for unbound %s %s',
    async (method, suffix, body) => {
      await makeUnbound();
      expect(
        (await request(method, suffix, body, new URLSearchParams(), null))
          .status
      ).toBe(401);
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );
  it.each(unboundCommands.slice(1))(
    'cannot access a bound resource by omitting its key on %s %s',
    async (method, suffix, body) => {
      expect(
        (await request(method, suffix, body, new URLSearchParams())).status
      ).toBe(404);
      expect(writes.commit).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
    }
  );
  it('excludes bound resources from unbound list and detail reads', async () => {
    const head = await projections.head(id);
    if (!head) throw new Error('Missing fixture head');
    projections.heads.mockResolvedValue([head]);
    expect(
      await (await request('GET', '', undefined, new URLSearchParams())).json()
    ).toEqual([]);
    expect(
      (await request('GET', '/' + id, undefined, new URLSearchParams())).status
    ).toBe(404);
  });
  it('cannot reach an unbound resource by supplying a consumer key', async () => {
    await makeUnbound();
    expect((await request('GET', '/' + id)).status).toBe(404);
    expect(
      (await request('PUT', '/' + id, { content, expectedRevision: 2 })).status
    ).toBe(404);
    expect(writes.commit).not.toHaveBeenCalled();
  });
  it.each(['POST', 'DELETE'])(
    'preserves unbound likes and rejects bound access for %s',
    async (method) => {
      const suffix = '/comments/' + id + '/like';
      expect(
        (await request(method, suffix, {}, new URLSearchParams())).status
      ).toBe(404);
      expect((await request(method, suffix, {})).status).toBe(400);
      expect(writes.commit).not.toHaveBeenCalled();
      await makeUnbound();
      resource = { ...resource, kind: 'comment' };
      expect(
        (await request(method, suffix, {}, new URLSearchParams())).status
      ).toBe(method === 'POST' ? 201 : 200);
      expect(writes.commit).toHaveBeenCalledWith(
        expect.objectContaining({ type: method === 'POST' ? 'like' : 'unlike' })
      );
    }
  );
  it.each(commands.slice(4))(
    'requires an explicit scope for %s %s',
    async (method, suffix, body) => {
      await makeUnbound();
      expect(
        (await request(method, suffix, body, new URLSearchParams())).status
      ).toBe(400);
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );
  it.each([
    { target: 'application', content },
    { content, ownerIdentityId: 'other' },
    { content, state: 'invalid' },
    { content, visibility: null },
  ])('rejects unrecognized fields and lifecycle input %#', async (body) => {
    expect((await request('POST', '', body)).status).toBe(400);
    expect(writes.commit).not.toHaveBeenCalled();
  });
  it('does not expose consumer-specific routes', async () => {
    for (const path of [
      '/discussion-bindings',
      '/application-discussions/' + id,
      '/article-comments/' + id,
      '/me/discussions',
      '/discussion-selection',
    ])
      expect((await fetch(origin + '/api' + path)).status).toBe(404);
  });
});
