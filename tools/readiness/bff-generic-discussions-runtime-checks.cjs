const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { createServer } = require('node:http');
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const execute = promisify(execFile);
const { Test } = require('@nestjs/testing');
const { Module, ValidationPipe } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { RabbitMqQueueClient } = require('@sdk/extras/queue-rabbitmq');
const amqp = require('amqplib');
const community = '../../apps/services/community/src/app/';
const materializer =
  '../../sdk/features/discussion/applications/materializer/service/src/';
const {
  AppModule,
} = require('../../apps/services/catalog-bff/src/app/app.module');
const {
  configureGenericDiscussionBody,
} = require('../../apps/services/catalog-bff/src/app/discussions/portal-generic-discussions.body');
const { AuthValidationMiddleware } = require(community +
  'middleware/auth-validation.middleware');
const { DurableDiscussionCommands } = require(community +
  'discussions/application/durable-discussion-commands');
const { MysqlDiscussionWrites } = require(community +
  'discussions/infrastructure/mysql-discussion-writes');
const { MongoDiscussionProjections } = require(community +
  'discussions/infrastructure/mongo-discussion-projections');
const { CryptoDiscussionIdentificatorGenerator } = require(community +
  'discussions/infrastructure/discussion-identificator.generator');
const { DiscussionOutboxDispatcher } = require(community +
  'discussions/infrastructure/discussion-outbox.dispatcher');
const {
  DiscussionsController,
  DISCUSSION_HTTP_OPTIONS,
} = require('@sdk/features/discussion/http');
const { communityDiscussionHttp } = require(community +
  'discussions/discussion-http.options');
const {
  ReviewsController,
  REVIEW_HTTP_OPTIONS,
} = require('@sdk/features/review/http');
const { communityReviewHttp } = require(community +
  'reviews/review-http.options');
const { ApplicationReviews } = require(community +
  'reviews/application/application-reviews');
const { MysqlReviews } = require(community +
  'reviews/infrastructure/mysql-reviews');
const { MysqlDiscussionSnapshotReader } = require(materializer +
  'mysql-snapshot-reader');
const { MinioImmutablePayloadReader } = require(materializer +
  'immutable-payload-reader');
const { MongoGenerationStore } = require(materializer +
  'mongo-generation-store');
const { materializeDiscussion } = require(materializer + 'materialization');

// Invoked only after discussion-recovery.test.cjs has claimed fresh, disposable stores.
module.exports = async function qualifyGenericDiscussionBff({
  source,
  pool,
  mongo,
  minio,
  payloads,
  password,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const run = randomUUID(),
    secret = randomUUID(),
    applicationId = randomUUID(),
    articleId = randomUUID();
  const directory = mkdtempSync(path.join(tmpdir(), 'wapps-discussion-bff-'));
  const container = 'wapps-discussion-bff-' + run;
  const previousSecret = process.env.INGRESS_AUTH_SECRET;
  process.env.INGRESS_AUTH_SECRET = secret;
  const actors = new Map([
    ['owner', { identityId: 'Owner-' + run, tenantId: 'default', roles: [] }],
    ['peer', { identityId: 'Peer-' + run, tenantId: 'default', roles: [] }],
    [
      'admin',
      { identityId: 'Admin-' + run, tenantId: 'default', roles: ['admin'] },
    ],
    ['foreign', { identityId: 'Foreign-' + run, tenantId: 'other', roles: [] }],
    ['denied', { identityId: 'Denied-' + run, tenantId: 'default', roles: [] }],
  ]);
  const tokens = new Map([...actors.keys()].map((key) => [key, randomUUID()]));
  let reviewParentAvailable = true,
    reviewPolicyAvailable = true;
  let parentVisible = true,
    owner,
    bff,
    ownerPort = 0,
    bffPort = 0,
    started = false;
  let bffRequests = 0,
    origin,
    alphaOrigin,
    brokerConnection,
    channel,
    dispatcher;
  const broker = new RabbitMqQueueClient();
  const queueName = 'wapps.bff.' + run;
  const config = { INGRESS_AUTH_SECRET: secret };
  const writes = new MysqlDiscussionWrites(source);
  const policy = {
    evaluate: async (context) => ({
      ok: true,
      value: context.identityId !== actors.get('denied').identityId,
    }),
  };
  const targets = {
    visible: async (target, tenant) =>
      parentVisible &&
      tenant === 'default' &&
      ((target.kind === 'application' && target.id === applicationId) ||
        (target.kind === 'article' && target.id === articleId)),
  };
  const ids = new CryptoDiscussionIdentificatorGenerator();
  const database = mongo.db(source.options.database);
  const nodes = database.collection('discussion_generation_nodes');
  const heads = database.collection('discussion_generation_heads');
  const store = new MongoGenerationStore(nodes, heads);
  const reader = new MysqlDiscussionSnapshotReader(pool);
  const loader = new MinioImmutablePayloadReader(minio);
  await store.ensureIndexes();
  const auth = createServer((request, response) => {
    const bearer = request.headers.authorization;
    const name = [...tokens].find(
      ([, token]) => bearer === 'Bearer ' + token
    )?.[0];
    if (bearer && !name) {
      response.writeHead(401);
      response.end();
      return;
    }
    const actor = actors.get(name);
    response.writeHead(200, {
      'X-Ingress-Auth': secret,
      'X-Anonymous': actor ? 'false' : 'true',
      ...(actor
        ? {
            'X-User-Id': actor.identityId,
            'X-User-Claims': JSON.stringify({
              tenantId: actor.tenantId,
              roles: actor.roles,
            }),
          }
        : {}),
    });
    response.end();
  });
  async function startOwner() {
    const projections = new MongoDiscussionProjections({
      collection: (name) => database.collection(name),
    });
    const bound = communityDiscussionHttp({
      source,
      writes,
      projections,
      payloads,
      policy,
      ids,
      targets,
      publicTenant: 'default',
    });
    const reviews = new ApplicationReviews(
      new MysqlReviews(source),
      {
        visible: async (id, tenant) => {
          if (!reviewParentAvailable)
            throw new Error('Parent fixture unavailable');
          return targets.visible({ kind: 'application', id }, tenant);
        },
      },
      {
        evaluate: async (context) => {
          if (!reviewPolicyAvailable)
            throw new Error('Policy fixture unavailable');
          return policy.evaluate(context);
        },
      },
      {
        next: randomUUID,
        fingerprint: (value) =>
          createHash('sha256').update(value).digest('hex'),
      },
      'default'
    );
    const controllers = [DiscussionsController, ReviewsController];
    class OwnerModule {
      configure(consumer) {
        consumer.apply(AuthValidationMiddleware).forRoutes(...controllers);
      }
    }
    Module({
      controllers,
      providers: [
        AuthValidationMiddleware,
        { provide: DISCUSSION_HTTP_OPTIONS, useValue: bound },
        {
          provide: REVIEW_HTTP_OPTIONS,
          useValue: communityReviewHttp(reviews),
        },
      ],
    })(OwnerModule);
    owner = (
      await Test.createTestingModule({ imports: [OwnerModule] }).compile()
    ).createNestApplication();
    owner.useBodyParser('json', { limit: '300kb' });
    owner.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    );
    owner.setGlobalPrefix('api');
    await owner.listen(ownerPort, '0.0.0.0');
    ownerPort = owner.getHttpServer().address().port;
    config.DISCUSSION_URL = `http://127.0.0.1:${ownerPort}`;
    config.EDITORIAL_URL = config.DISCUSSION_URL;
  }
  async function startBff() {
    bff = (
      await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ConfigService)
        .useValue({ get: (key) => config[key] })
        .compile()
    ).createNestApplication();
    configureGenericDiscussionBody(bff);
    bff.use((_request, _response, next) => {
      bffRequests++;
      next();
    });
    bff.setGlobalPrefix('api');
    await bff.listen(bffPort, '0.0.0.0');
    bffPort = bff.getHttpServer().address().port;
  }
  async function docker(args) {
    return execute('docker', args, { timeout: 30000, maxBuffer: 65536 });
  }
  async function startIngress() {
    await new Promise((resolve) => auth.listen(0, '0.0.0.0', resolve));
    const authPort = auth.address().port;
    for (const deployment of ['local', 'alpha']) {
      const folder = path.join(directory, deployment);
      mkdirSync(folder);
      const from = path.join(__dirname, '../../deploy', deployment, 'nginx');
      const content = readFileSync(path.join(from, 'api.conf'), 'utf8')
        .replaceAll(
          `/etc/nginx/${deployment === 'local' ? 'local' : 'wapps'}/`,
          `/etc/nginx/qualification/${deployment}/`
        )
        .replace(/http:\/\/([a-z_-]+)(?::\d+)?/g, (_all, service) =>
          service === 'local_auth'
            ? 'http://local_auth'
            : `http://host.docker.internal:${
                service === 'portal_bff'
                  ? bffPort
                  : service === 'discussion'
                  ? ownerPort
                  : 1
              }`
        );
      writeFileSync(path.join(folder, 'api.conf'), content);
      writeFileSync(
        path.join(folder, 'auth.conf'),
        readFileSync(path.join(from, 'auth.conf'))
      );
      writeFileSync(
        path.join(folder, 'application-media.conf'),
        '# Unrelated media routes excluded from this qualification.\n'
      );
    }
    writeFileSync(
      path.join(directory, 'nginx.conf'),
      `events {}\nhttp {
      access_log off;
      limit_req_zone $binary_remote_addr zone=identity_recovery:1m rate=10r/s;
      limit_req_zone $binary_remote_addr zone=identity_enrollment:1m rate=10r/s;
      map $request_method $validation_path { default /validate; }
      proxy_http_version 1.1;
      upstream local_auth { server host.docker.internal:${authPort}; keepalive 32; keepalive_timeout 3s; }
      server { listen 8080; include /etc/nginx/qualification/local/api.conf; }
      server { listen 8081; include /etc/nginx/qualification/alpha/api.conf; }
    }\n`
    );
    await docker([
      'run',
      '--detach',
      '--pull=never',
      '--name',
      container,
      ...(process.platform === 'linux'
        ? ['--add-host', 'host.docker.internal:host-gateway']
        : []),
      '--publish',
      '127.0.0.1::8080',
      '--publish',
      '127.0.0.1::8081',
      '--mount',
      `type=bind,source=${directory},target=/etc/nginx/qualification,readonly`,
      'nginx:1.28-alpine',
      'nginx',
      '-c',
      '/etc/nginx/qualification/nginx.conf',
      '-g',
      'daemon off;',
    ]);
    started = true;
    for (const port of [8080, 8081]) {
      const result = await docker([
        'inspect',
        '--format',
        `{{(index (index .NetworkSettings.Ports "${port}/tcp") 0).HostPort}}`,
        container,
      ]);
      const value = Number(result.stdout.trim());
      assert.ok(Number.isInteger(value) && value > 0);
      if (port === 8080) origin = 'http://127.0.0.1:' + value;
      else alphaOrigin = 'http://127.0.0.1:' + value;
    }
    await docker([
      'exec',
      container,
      'nginx',
      '-c',
      '/etc/nginx/qualification/nginx.conf',
      '-t',
    ]);
  }
  async function call(
    route,
    {
      method = 'GET',
      body,
      user = 'owner',
      key = randomUUID(),
      status = method === 'POST' ? 201 : 200,
      at = origin,
      headers = {},
    } = {}
  ) {
    const response = await fetch(at + '/api/' + route, {
      method,
      headers: {
        ...(user ? { Authorization: 'Bearer ' + tokens.get(user) } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'Idempotency-Key': key }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(
      response.status,
      status,
      `${method} ${route}: unexpected HTTP status`
    );
    const text = await response.text();
    if (status < 500 && status !== 401)
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    return text.startsWith('{') || text.startsWith('[')
      ? JSON.parse(text)
      : null;
  }
  async function project(id) {
    const deadline = Date.now() + 12000;
    do {
      const message = await channel.get(queueName, { noAck: false });
      if (message) {
        const event = JSON.parse(message.content.toString());
        await materializeDiscussion(
          event.payload.discussionId,
          reader,
          loader,
          store
        );
        channel.ack(message);
      }
      const current = await writes.resource(id);
      if ((await heads.findOne({ _id: id }))?.revision === current.revision)
        return;
      await delay(40);
    } while (Date.now() < deadline);
    throw new Error('Durable outbox/broker materialization did not converge');
  }
  const change = (id, content, expectedRevision, options = {}) =>
    call('discussions/' + id, {
      method: 'PUT',
      body: { content, expectedRevision },
      ...options,
    });
  const pass = (message) => console.log('PASS ' + message);
  try {
    await startOwner();
    await startBff();
    await startIngress();
    const queue = await broker.connect({
      host: '127.0.0.1',
      port: process.env.DISCUSSION_TEST_QUEUE_PORT,
      username: 'wapps',
      password,
    });
    const isolatedQueue = {
      ...queue,
      assertQueue: (_name, options) => queue.assertQueue(queueName, options),
      publishConfirmed: (_name, content, options) =>
        queue.publishConfirmed(queueName, content, options),
    };
    dispatcher = new DiscussionOutboxDispatcher(
      source,
      isolatedQueue,
      broker,
      new ConfigService()
    );
    await dispatcher.onModuleInit();
    brokerConnection = await amqp.connect(
      `amqp://wapps:${encodeURIComponent(password)}@127.0.0.1:${
        process.env.DISCUSSION_TEST_QUEUE_PORT
      }`
    );
    channel = await brokerConnection.createChannel();

    const content = {
        'consumer:future:v8': [
          'x'.repeat(150000),
          false,
          42,
          { nested: '\u754c' },
        ],
      },
      key = randomUUID();
    const created = await call('discussions', {
      method: 'POST',
      body: { content },
      key,
    });
    assert.equal(created.revision, 1);
    assert.equal(created.id, created.discussionId);
    assert.deepEqual(
      await call('discussions', { method: 'POST', body: { content }, key }),
      created
    );
    await call('discussions', {
      method: 'POST',
      body: { content: 'different' },
      key,
      status: 409,
    });
    await call('discussions/' + created.id, { user: null, status: 503 });
    await project(created.id);
    assert.deepEqual(
      (await call('discussions/' + created.id, { user: null })).nodes[0].payload
        .content,
      content
    );
    for (const at of [origin, alphaOrigin]) {
      const before = bffRequests;
      assert.equal(
        (await call('discussions/' + created.id, { at, user: null })).aggregate
          .revision,
        1
      );
      assert.equal(bffRequests, before + 1, 'Ingress must traverse BFF');
    }
    pass(
      'local and alpha ingress -> production BFF -> owner -> SQL/object/outbox/broker/Mongo; large JSON and replay'
    );

    await call('discussions', {
      method: 'POST',
      body: { content: 'denied' },
      user: null,
      status: 401,
    });
    await call('discussions', {
      method: 'POST',
      body: { content: 'denied' },
      user: 'denied',
      status: 403,
    });
    await call('discussions/' + created.id, { user: 'foreign', status: 404 });
    await change(created.id, 'forged edit', 1, {
      user: 'peer',
      status: 403,
      headers: {
        'X-User-Id': actors.get('owner').identityId,
        'X-Ingress-Auth': secret,
        'X-User-Claims': '{"roles":["admin"]}',
      },
    });
    await call('discussions', {
      method: 'POST',
      body: { content: 'injected', bindingKey: 'application:any' },
      status: 400,
    });
    pass(
      'anonymous mutation, cross-tenant read, policy denial and forged ownership rejected'
    );

    const reply = await call(`discussions/${created.id}/comments`, {
      method: 'POST',
      body: { content: 'peer reply' },
      user: 'peer',
    });
    const nested = await call(`discussions/${reply.id}/comments`, {
      method: 'POST',
      body: { content: ['nested'] },
    });
    const likeKey = randomUUID();
    const liked = await call(`discussions/comments/${reply.id}/like`, {
      method: 'POST',
      key: likeKey,
    });
    assert.deepEqual(
      await call(`discussions/comments/${reply.id}/like`, {
        method: 'POST',
        key: likeKey,
      }),
      liked
    );
    await project(created.id);
    assert.equal(
      (await call('discussions/' + created.id)).nodes.find(
        (n) => n.id === reply.id
      ).likeCount,
      1
    );
    const unliked = await call(`discussions/comments/${reply.id}/like`, {
      method: 'DELETE',
    });
    await project(created.id);
    assert.equal(
      (await call('discussions/' + created.id)).nodes.find(
        (n) => n.id === reply.id
      ).likeCount,
      0
    );
    const editKey = randomUUID();
    const edited = await change(reply.id, 'edited reply', unliked.revision, {
      user: 'peer',
      key: editKey,
    });
    await change(reply.id, 'stale edit', unliked.revision, {
      user: 'peer',
      status: 409,
    });
    await call('discussions/' + created.id, { status: 503 });
    assert.ok(
      !(await call('discussions')).some((item) => item._id === created.id),
      'Stale list head is withheld'
    );
    await project(created.id);
    assert.equal(
      (await call('discussions/' + created.id)).nodes.find(
        (n) => n.id === reply.id
      ).payload.content,
      'edited reply'
    );
    pass(
      'nested replies, like/unlike membership, exact replay, stale revisions and projection lag'
    );

    const privateChange = await call('discussions/' + created.id, {
      method: 'PUT',
      body: {
        content,
        expectedRevision: edited.revision,
        visibility: 'private',
      },
    });
    await call('discussions/' + created.id, { user: null, status: 404 });
    await call('discussions/' + created.id, { user: 'peer', status: 404 });
    await project(created.id);
    assert.equal(
      (await call('discussions/' + created.id)).aggregate.visibility,
      'private'
    );
    const publicChange = await call('discussions/' + created.id, {
      method: 'PUT',
      body: {
        content,
        expectedRevision: privateChange.revision,
        visibility: 'public',
      },
    });
    await project(created.id);
    const removedReply = await call('discussions/' + reply.id, {
      method: 'DELETE',
      body: { expectedRevision: publicChange.revision },
      user: 'peer',
    });
    await project(created.id);
    const redacted = (await call('discussions/' + created.id)).nodes.find(
      (n) => n.id === reply.id
    );
    assert.deepEqual(redacted, {
      id: reply.id,
      parentId: created.id,
      depth: 1,
      kind: 'comment',
      payload: null,
      redacted: true,
    });
    assert.equal(
      (await call('discussions/' + created.id)).nodes.find(
        (n) => n.id === nested.id
      ).payload.content[0],
      'nested'
    );
    pass(
      'immediate privacy revocation and removed-ancestor redaction preserve reachable children'
    );

    const oldSnapshot = await reader.read(created.id);
    const oldNodes = await nodes.find({ discussionId: created.id }).toArray();
    await bff.close();
    bff = undefined;
    await startBff();
    await owner.close();
    owner = undefined;
    await call('discussions/' + created.id, { status: 503 });
    await startOwner();
    assert.equal(
      (await call('discussions/' + created.id)).aggregate.revision,
      removedReply.revision
    );
    assert.deepEqual(
      await call('discussions', { method: 'POST', body: { content }, key }),
      created
    );
    await mongo.close();
    await call('discussions/' + created.id, { status: 503 });
    await mongo.connect();
    assert.equal(
      (await call('discussions/' + created.id)).aggregate.revision,
      removedReply.revision
    );
    pass(
      'BFF/owner service recreation, owner outage, Mongo disconnect and historical receipt replay'
    );

    const historical = new DurableDiscussionCommands(
      writes,
      payloads,
      policy,
      ids,
      targets
    );
    const topicBody = {
      title: 'Bound application topic',
      tags: ['tools'],
      displayName: 'Owner',
      text: 'Bound text',
    };
    const articleBody = { displayName: 'Owner', text: 'Article text' };
    const topicKey = randomUUID(),
      articleKey = randomUUID();
    const acceptedTopic = await historical.create(
      {
        content: topicBody,
        subjectId: applicationId,
        target: { kind: 'application', id: applicationId },
      },
      actors.get('owner'),
      topicKey
    );
    const acceptedComment = await historical.create(
      {
        content: articleBody,
        subjectId: articleId,
        target: { kind: 'article', id: articleId },
      },
      actors.get('owner'),
      articleKey
    );
    const applicationTopic = await call(
      'application-discussions/' + applicationId,
      { method: 'POST', body: topicBody, key: topicKey }
    );
    const articleComment = await call('article-comments/' + articleId, {
      method: 'POST',
      body: articleBody,
      key: articleKey,
    });
    assert.deepEqual(applicationTopic, acceptedTopic);
    assert.deepEqual(articleComment, acceptedComment);
    await project(applicationTopic.id);
    await project(articleComment.id);
    assert.equal(
      (
        await call(
          `application-discussions/${applicationId}/${applicationTopic.id}`
        )
      ).title,
      'Bound application topic'
    );
    assert.equal(
      (await call(`article-comments/${articleId}/${articleComment.id}`))
        .comments[0].content.text,
      'Article text'
    );
    const appBase = `application-discussions/${applicationId}`;
    const commentBase = `article-comments/${articleId}`;
    for (const at of [origin, alphaOrigin]) {
      const before = bffRequests;
      assert.equal(
        (await call(appBase, { at })).items[0].title,
        topicBody.title
      );
      assert.equal(
        (await call(commentBase, { at })).items[0].comments[0].content.text,
        articleBody.text
      );
      assert.equal(
        (await call('me/discussions', { at })).items[0].id,
        applicationTopic.id
      );
      assert.equal(
        (
          await call('discussion-selection?ids=' + applicationTopic.id, {
            at,
            user: null,
          })
        ).items[0].applicationId,
        applicationId
      );
      assert.equal(bffRequests, before + 4);
    }
    const topicReply = await call(`${appBase}/${applicationTopic.id}/replies`, {
      method: 'POST',
      body: { displayName: 'Peer', text: 'x'.repeat(5000) },
      user: 'peer',
    });
    const topicVote = await call(`${appBase}/${topicReply.id}/vote`, {
      method: 'PUT',
      body: { value: 1, expectedRevision: topicReply.revision },
    });
    const topicPin = await call(`${appBase}/${applicationTopic.id}/pin`, {
      method: 'PUT',
      body: { pinned: true, expectedRevision: topicVote.revision },
      user: 'admin',
    });
    await project(applicationTopic.id);
    const topicThread = await call(`${appBase}/${applicationTopic.id}`);
    assert.equal(topicThread.pinned, true);
    assert.equal(topicThread.comments[1].content.text.length, 5000);
    assert.deepEqual(topicThread.comments[1].votes, {
      upvotes: 1,
      downvotes: 0,
      mine: 1,
    });
    assert.equal(
      (await call('me/discussions', { user: 'peer' })).items[0].participation,
      'participant'
    );
    await call(`${appBase}/${applicationTopic.id}`, {
      method: 'PUT',
      body: { expectedRevision: topicPin.revision, content: topicBody },
      user: 'peer',
      status: 403,
    });
    const articleReply = await call(
      `${commentBase}/${articleComment.id}/replies`,
      {
        method: 'POST',
        body: { displayName: 'Peer', text: 'Article reply' },
        user: 'peer',
      }
    );
    await project(articleComment.id);
    assert.equal(
      (await call(`${commentBase}/${articleComment.id}`)).replyCount,
      1
    );
    await call(`${commentBase}/${articleReply.id}`, {
      method: 'DELETE',
      body: { expectedRevision: articleReply.revision },
      user: 'peer',
    });
    await project(articleComment.id);
    assert.equal(
      (await call(`${commentBase}/${articleComment.id}`)).comments[1].content,
      null
    );
    for (const path of [
      appBase,
      commentBase,
      'me/discussions',
      'discussion-selection?ids=' + applicationTopic.id,
      'discussion-bindings',
      'discussion-bindings?bindingKey=application%3A' + applicationId,
    ])
      assert.equal(
        (await fetch(`http://127.0.0.1:${ownerPort}/api/${path}`)).status,
        404
      );
    pass(
      'historical Wapps receipts replay through generic owner API; both ingress configs preserve topics/comments/discovery, votes/pins, permissions and redaction; dedicated owner routes retired'
    );
    const fixture =
      await require('./discussion-portal-fixture.cjs').discussionPortalFixture(
        {
          origin: `http://127.0.0.1:${ownerPort}`,
          stop: async () => undefined,
        },
        {
          INGRESS_AUTH_SECRET: secret,
          EDITORIAL_URL: `http://127.0.0.1:${ownerPort}`,
        }
      );
    try {
      assert.equal(
        (
          await call(`${appBase}/${applicationTopic.id}`, {
            at: fixture.origin,
            user: null,
          })
        ).title,
        topicBody.title
      );
      assert.equal(
        (
          await call('me/discussions', {
            at: fixture.origin,
            user: null,
            headers: {
              'X-Ingress-Auth': secret,
              'X-User-Id': actors.get('owner').identityId,
            },
          })
        ).items[0].id,
        applicationTopic.id
      );
      await call('me/discussions', {
        at: fixture.origin,
        user: null,
        headers: { 'X-User-Id': actors.get('owner').identityId },
        status: 401,
      });
      const {
        PublicFavoriteTargets,
      } = require('../../sdk/features/identity/applications/management/service/src/app/infrastructure/public-favorite-targets');
      const { HttpService } = require('@nestjs/axios');
      const eligibility = new PublicFavoriteTargets(
        new HttpService(),
        fixture.origin,
        fixture.serviceOrigin
      );
      assert.equal(
        await eligibility.available({
          kind: 'discussions',
          id: applicationTopic.id,
        }),
        true
      );
      parentVisible = false;
      assert.equal(
        await eligibility.available({
          kind: 'discussions',
          id: applicationTopic.id,
        }),
        false
      );
      parentVisible = true;
    } finally {
      await fixture.stop();
    }
    pass(
      'legacy journey fixture traverses production BFF; forged identity denied; Account favorite eligibility uses generic owner selection and current parent authority'
    );

    for (const bound of [applicationTopic, articleComment]) {
      await call('discussions/' + bound.id, { status: 404 });
      await change(bound.id, 'unbound edit', bound.revision, { status: 404 });
      await call(`discussions/${bound.id}/comments`, {
        method: 'POST',
        body: { content: 'unbound reply' },
        status: 404,
      });
    }
    await call(
      `application-discussions/${randomUUID()}/${applicationTopic.id}`,
      { status: 404 }
    );
    assert.ok(
      (await call('discussions')).every(
        (item) => ![applicationTopic.id, articleComment.id].includes(item._id)
      )
    );
    const review = await call(`application-reviews/${applicationId}/mine`, {
      method: 'PUT',
      body: {
        expectedRevision: 0,
        content: { displayName: 'Owner', text: 'Review', rating: 4 },
      },
    });
    assert.equal(
      (await call(`application-reviews/${applicationId}/${review.id}`)).content
        .rating,
      4
    );
    parentVisible = false;
    await call(
      `application-discussions/${applicationId}/${applicationTopic.id}`,
      { status: 404 }
    );
    await call(`article-comments/${articleId}/${articleComment.id}`, {
      status: 404,
    });
    await call(`application-reviews/${applicationId}/${review.id}`, {
      status: 404,
    });
    parentVisible = true;
    pass(
      'application topics, article comments and SQL reviews regressions; exact consumer binding and parent denial'
    );

    await require('./bff-reviews-runtime-checks.cjs')({
      source,
      mongo,
      call,
      applicationId,
      actors,
      secret,
      ownerOrigin: `http://127.0.0.1:${ownerPort}`,
      gateways: [origin, alphaOrigin],
      setParentVisible: (value) => {
        parentVisible = value;
      },
      setParentAvailable: (value) => {
        reviewParentAvailable = value;
      },
      setPolicyAvailable: (value) => {
        reviewPolicyAvailable = value;
      },
      bffCount: () => bffRequests,
      recreate: async (unavailable) => {
        await owner.close();
        owner = undefined;
        await unavailable();
        await bff.close();
        bff = undefined;
        await startOwner();
        await startBff();
      },
      pass,
    });

    await require('./bound-discussion-runtime-checks.cjs')({
      source,
      writes,
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
    });

    const deleted = await call('discussions/' + created.id, {
      method: 'DELETE',
      body: { expectedRevision: removedReply.revision },
    });
    await call('discussions/' + created.id, { status: 404 });
    await project(created.id);
    assert.equal(
      await materializeDiscussion(
        created.id,
        { read: async () => oldSnapshot },
        loader,
        store
      ),
      'superseded'
    );
    assert.equal(
      (await heads.findOne({ _id: created.id })).revision,
      deleted.revision
    );
    await call('discussions/' + created.id, { status: 404 });
    assert.ok(
      oldNodes.some((n) => n.payload),
      'The stale generation fixture contains live content'
    );
    assert.ok(
      !(await call('discussions')).some((item) => item._id === created.id)
    );
    pass(
      'immediate root deletion, durable tombstones and stale-generation resurrection prevention'
    );
  } catch (error) {
    if (started) {
      const logs = await docker(['logs', '--tail', '30', container]);
      console.error(logs.stderr);
    }
    throw error;
  } finally {
    await dispatcher?.onModuleDestroy();
    if (channel) await channel.deleteQueue(queueName);
    await broker.close();
    await brokerConnection?.close();
    if (started) {
      await docker(['stop', '--time', '5', container]);
      await docker(['rm', '--volumes', container]);
    }
    await bff?.close();
    await owner?.close();
    auth.closeAllConnections();
    if (auth.listening)
      await new Promise((resolve, reject) =>
        auth.close((error) => (error ? reject(error) : resolve()))
      );
    if (previousSecret === undefined) delete process.env.INGRESS_AUTH_SECRET;
    else process.env.INGRESS_AUTH_SECRET = previousSecret;
    rmSync(directory, { recursive: true, force: true });
  }
};
