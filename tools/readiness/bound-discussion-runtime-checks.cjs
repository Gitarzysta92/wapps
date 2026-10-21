const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { Module } = require('@nestjs/common');
const { PermissionDeniedError } = require('@sdk/kernel/ontology/authority');
const {
  DiscussionsController,
  DISCUSSION_HTTP_OPTIONS,
} = require('@sdk/features/discussion/http');
const {
  BoundDiscussionQueries,
  DiscussionDiscovery,
  DiscussionQueries,
  DurableDiscussionCommands,
} = require('@sdk/features/discussion/libs/management');
const community = '../../apps/services/community/src/app/';
const { communityDiscussionWrites } = require(community +
  'discussions/application/community-discussion-writes');
const { MongoDiscussionProjections } = require(community +
  'discussions/infrastructure/mongo-discussion-projections');
const { MysqlBoundDiscussionIndex } = require(community +
  'discussions/infrastructure/mysql-bound-discussion-index');
const { MysqlBoundDiscussionParticipation } = require(community +
  'discussions/infrastructure/mysql-bound-discussion-participation');
const { MysqlDiscussionVotes } = require(community +
  'discussions/infrastructure/mysql-discussion-votes');
const { AuthValidationMiddleware } = require(community +
  'middleware/auth-validation.middleware');
const { extractAuthUser } = require(community +
  'decorators/auth-user.decorator');
const { discussionActor } = require(community + 'discussions/discussion-actor');
const {
  materializeDiscussion,
} = require('../../sdk/features/discussion/applications/materializer/service/src/materialization');

// This fixture supplies a second consumer's policy/adapters, never changing the reusable handlers or materializer.
module.exports = async function qualifyBoundDiscussionConsumer({
  source,
  writes: canonical,
  database,
  payloads,
  policy,
  ids,
  project,
  actors,
  secret,
  reader,
  loader,
  store,
  pass,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const key = 'OtherConsumer|record@v987/' + randomUUID() + '?slot=a&part=b';
  const otherKey = key.toUpperCase();
  let visible = true,
    app,
    origin;
  const bindings = {
    visible: async (binding, tenant) =>
      visible && tenant === 'default' && [key, otherKey].includes(binding),
    content: (_binding, _node, value) => value,
    authorize: async (_binding, actor) => {
      if (actor.identityId === actors.get('denied').identityId)
        throw new PermissionDeniedError('consumer.denied');
    },
    context: async () => undefined,
    fingerprintInput: (input) => input,
    anonymous: () => ({ content: null }),
  };
  const writes = communityDiscussionWrites(canonical, () => null);
  async function start() {
    const unboundQueries = new DiscussionQueries(
      writes,
      new MongoDiscussionProjections({
        collection: (name) => database.collection(name),
      }),
      'default',
      bindings
    );
    const queries = new BoundDiscussionQueries(
      unboundQueries,
      writes,
      new MysqlBoundDiscussionIndex(source),
      bindings,
      'default',
      new MysqlDiscussionVotes(source)
    );
    const options = {
      commands: new DurableDiscussionCommands(
        writes,
        payloads,
        policy,
        ids,
        bindings
      ),
      queries,
      unboundQueries,
      discovery: new DiscussionDiscovery(
        queries,
        writes,
        bindings,
        new MysqlBoundDiscussionParticipation(source),
        async () => undefined,
        'default'
      ),
      actor: (request, required) =>
        discussionActor(extractAuthUser(request, !required)),
    };
    class ConsumerModule {
      configure(consumer) {
        consumer
          .apply(AuthValidationMiddleware)
          .forRoutes(DiscussionsController);
      }
    }
    Module({
      controllers: [DiscussionsController],
      providers: [
        AuthValidationMiddleware,
        { provide: DISCUSSION_HTTP_OPTIONS, useValue: options },
      ],
    })(ConsumerModule);
    app = (
      await Test.createTestingModule({ imports: [ConsumerModule] }).compile()
    ).createNestApplication();
    app.useBodyParser('json', { limit: '300kb' });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  }
  async function call(
    suffix = '',
    {
      method = 'GET',
      body,
      command = randomUUID(),
      bindingKey = key,
      user = 'owner',
      status = method === 'POST' ? 201 : 200,
      admin = false,
      query,
    } = {}
  ) {
    const actor = actors.get(user);
    const response = await fetch(
      origin +
        '/api/discussions' +
        suffix +
        '?' +
        new URLSearchParams(query ?? { bindingKey }),
      {
        method,
        headers: {
          ...(actor
            ? {
                'X-Ingress-Auth': secret,
                'X-User-Id': actor.identityId,
                'X-Anonymous': 'false',
                'X-User-Claims': JSON.stringify({
                  tenantId: actor.tenantId,
                  roles: admin ? ['admin'] : actor.roles,
                }),
              }
            : {}),
          ...(method === 'GET' ? {} : { 'Idempotency-Key': command }),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20000),
      }
    );
    const value = await response.json();
    assert.equal(
      response.status,
      status,
      `${method} ${suffix}: ${JSON.stringify(value)}`
    );
    return value;
  }
  try {
    await start();
    const content = {
      arbitrary: [
        42,
        true,
        { format: 'consumer-owned', value: 'x'.repeat(150000) },
      ],
    };
    const command = randomUUID();
    const created = await call('', {
      method: 'POST',
      body: { content },
      command,
    });
    assert.deepEqual(
      await call('', { method: 'POST', body: { content }, command }),
      created
    );
    await call('', {
      method: 'POST',
      body: { content: 'conflict' },
      command,
      status: 409,
    });
    await call('/' + created.id, { status: 503 });
    await project(created.id);
    assert.deepEqual(
      (await call('/' + created.id, { user: null })).comments[0].content,
      content
    );
    const [row] = await source.query(
      'SELECT bindingKey, subjectKind, subjectId FROM discussion_write_aggregates WHERE id=?',
      [created.id]
    );
    assert.deepEqual(
      { ...row },
      { bindingKey: key, subjectKind: null, subjectId: null }
    );
    assert.equal((await reader.read(created.id)).bindingKey, key);
    await call('/' + created.id, { query: {}, status: 404 });
    await call('/' + created.id, {
      method: 'PUT',
      query: {},
      body: { content, expectedRevision: 1 },
      status: 404,
    });
    await call('', { query: { bindingKey: '' }, status: 400 });
    assert.equal(
      (await fetch(origin + '/api/discussion-bindings')).status,
      404
    );
    await call('/' + created.id, { bindingKey: otherKey, status: 404 });
    await call('/' + created.id, { user: 'foreign', status: 404 });
    await call('', {
      method: 'POST',
      body: { content },
      user: null,
      status: 401,
    });
    await call('', {
      method: 'POST',
      body: { content },
      user: 'denied',
      status: 403,
    });
    await call('/' + created.id, {
      method: 'PUT',
      body: { content, expectedRevision: 1 },
      user: 'peer',
      status: 403,
    });
    const reply = await call('/' + created.id + '/comments', {
      method: 'POST',
      body: { content: { otherPayload: ['reply'] } },
      user: 'peer',
    });
    const nested = await call('/' + reply.id + '/comments', {
      method: 'POST',
      body: { content: ['nested', 9] },
    });
    await project(created.id);
    assert.equal(
      (await call('/' + created.id)).comments.find(
        (node) => node.id === nested.id
      ).parentId,
      reply.id
    );
    const voted = await call('/' + reply.id + '/vote', {
      method: 'PUT',
      body: { value: 1, expectedRevision: nested.revision },
    });
    const pinned = await call('/' + created.id + '/pin', {
      method: 'PUT',
      body: { pinned: true, expectedRevision: voted.revision },
      admin: true,
    });
    await project(created.id);
    const voteView = await call('/' + created.id, {
      query: { bindingKey: key, includeVotes: 'true' },
    });
    assert.equal(voteView.pinned, true);
    assert.deepEqual(
      voteView.comments.find((node) => node.id === reply.id).votes,
      { upvotes: 1, downvotes: 0, mine: 1 }
    );
    assert.equal(
      (await call('', { query: { bindingKey: key, order: 'pinned' } })).items[0]
        .id,
      created.id
    );
    const additional = [];
    for (let index = 0; index < 11; index++)
      additional.push(
        await call('', { method: 'POST', body: { content: { index } } })
      );
    for (const item of additional) await project(item.id);
    const firstPage = await call('', {
      query: { bindingKey: key, order: 'pinned' },
    });
    assert.equal(firstPage.items.length, 10);
    assert.equal(firstPage.items[0].id, created.id);
    const secondPage = await call('', {
      query: { bindingKey: key, order: 'pinned', cursor: firstPage.next },
    });
    assert.equal(secondPage.items.length, 2);
    assert.equal(secondPage.next, null);
    assert.equal(
      new Set([...firstPage.items, ...secondPage.items].map((item) => item.id))
        .size,
      12
    );
    const other = await call('', {
      method: 'POST',
      body: { content: ['another binding'] },
      bindingKey: otherKey,
    });
    await project(other.id);
    assert.deepEqual(
      (await call('', { bindingKey: otherKey })).items.map((item) => item.id),
      [other.id]
    );
    const selected = await call('/selection', {
      query: { bindingPrefix: 'OtherConsumer|', ids: created.id },
      user: null,
    });
    assert.equal(selected.items[0].bindingKey, key);
    const participation = await call('/participation', {
      query: { bindingPrefix: 'OtherConsumer|' },
      user: 'peer',
    });
    assert.equal(participation.items[0].participation, 'participant');
    visible = false;
    await call('/' + created.id, { status: 404 });
    await call('', { method: 'POST', body: { content }, command, status: 404 });
    assert.deepEqual(
      (
        await call('/selection', {
          query: { bindingPrefix: 'OtherConsumer|', ids: created.id },
        })
      ).items,
      []
    );
    visible = true;
    const privateChange = await call('/' + created.id, {
      method: 'PUT',
      body: {
        content,
        expectedRevision: pinned.revision,
        visibility: 'private',
      },
    });
    await call('/' + created.id, { user: null, status: 404 });
    await call('/' + created.id, { user: 'peer', status: 404 });
    const publicChange = await call('/' + created.id, {
      method: 'PUT',
      body: {
        content,
        expectedRevision: privateChange.revision,
        visibility: 'public',
      },
    });
    const removalKey = randomUUID();
    const removed = await call('/' + reply.id, {
      method: 'DELETE',
      body: { expectedRevision: publicChange.revision },
      user: 'peer',
      command: removalKey,
    });
    await project(created.id);
    const current = await call('/' + created.id);
    assert.equal(
      current.comments.find((node) => node.id === reply.id).content,
      null
    );
    assert.deepEqual(
      current.comments.find((node) => node.id === nested.id).content,
      ['nested', 9]
    );
    assert.deepEqual(
      await call('/' + reply.id, {
        method: 'DELETE',
        body: { expectedRevision: publicChange.revision },
        user: 'peer',
        command: removalKey,
      }),
      removed
    );
    await app.close();
    app = undefined;
    await start();
    assert.equal((await call('/' + created.id)).revision, removed.revision);
    assert.deepEqual(
      await call('', { method: 'POST', body: { content }, command }),
      created
    );
    const snapshot = await reader.read(created.id);
    const deleted = await call('/' + created.id, {
      method: 'DELETE',
      body: { expectedRevision: removed.revision },
    });
    await call('/' + created.id, { status: 404 });
    await project(created.id);
    assert.equal(
      await materializeDiscussion(
        created.id,
        { read: async () => snapshot },
        loader,
        store
      ),
      'superseded'
    );
    assert.equal(
      (
        await database
          .collection('discussion_generation_heads')
          .findOne({ _id: created.id })
      ).revision,
      deleted.revision
    );
    for (const path of [
      'application-discussions/' + randomUUID(),
      'article-comments/' + randomUUID(),
      'me/discussions',
      'discussion-selection',
    ])
      assert.equal((await fetch(origin + '/api/' + path)).status, 404);
    pass(
      'second consumer through unchanged generic HTTP handlers and materializer: opaque key/payload, SQL/object/broker/Mongo, exact-key/tenant/owner denial, replies/votes/pins, discovery, revocation, recreation, replay and tombstones'
    );
  } finally {
    await app?.close();
  }
};
