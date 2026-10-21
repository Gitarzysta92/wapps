const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServer } = require('node:http');
const { randomUUID, createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { recoveryFixture } = require('./recovery-runtime-fixture.cjs');

const ownerBundle = 'sdk/features/discussion/applications/management';
const workerBundle = 'sdk/features/discussion/applications/materializer';

test(
  'compiled Discussion SIGKILL windows and bounded Editorial initialization diagnostics on fresh real stores',
  { timeout: 360000 },
  async () => {
    assert.equal(
      process.env.WAPPS_DISCUSSION_CRASH_INTEGRATION,
      '1',
      'Explicit opt-in, finished builds and disposable Docker providers are required'
    );
    const f = await recoveryFixture();
    const {
      sql,
      mongo,
      channel,
      s3,
      launch,
      until,
      observe,
      queue,
      failedQueue,
    } = f;
    let owner, worker, parent, initializationFailure;
    let launchNumber = 0,
      parentVisible = true;
    const actor = 'Owner-' + f.id,
      peer = 'Peer-' + f.id,
      erased = 'Erased-' + f.id;
    const parentId = randomUUID(),
      bindingKey = 'application:' + parentId;
    const heads = mongo
      .db('discussion')
      .collection('discussion_generation_heads');
    const nodes = mongo
      .db('discussion')
      .collection('discussion_generation_nodes');
    const topic = (text) => ({
      title: text,
      displayName: 'Recovery owner',
      text,
      tags: [],
    });
    const requestBody = (content) => ({
      content: topic(content),
      subjectId: parentId,
      state: 'published',
      visibility: 'public',
    });
    const rows = async (query, params = []) =>
      (await sql.query(query, params))[0];
    async function pending() {
      return (
        await rows(
          'SELECT COUNT(*) n FROM discussion_outbox WHERE deliveredAt IS NULL'
        )
      )[0].n;
    }
    async function queueEmpty() {
      return until(async () => {
        const state = await f.queueState();
        assert.equal(state.messages_ready, 0);
        assert.equal(state.messages_unacknowledged, 0);
      }, 'queue fully acknowledged');
    }
    async function startOwner(instrument = true) {
      owner = launch(
        'owner-' + launchNumber++,
        ownerBundle,
        [],
        {},
        instrument
      );
      await until(async () => {
        assert.equal(owner.child.exitCode, null, owner.logs().slice(-2000));
        const response = await fetch(origin + '/api/health', {
          signal: AbortSignal.timeout(1000),
        });
        assert.equal(response.status, 200);
        await response.arrayBuffer();
      }, 'owner startup');
    }
    async function startWorker(mode) {
      worker = launch('worker-' + launchNumber++, workerBundle, [], {}, true);
      if (mode) await worker.arm(mode);
      await until(async () => {
        const state = await f.queueState();
        assert.equal(state.consumers, 1);
      }, 'worker consumer ready');
    }
    async function call(
      suffix = '',
      {
        method = 'GET',
        body,
        key = randomUUID(),
        user = actor,
        tenant = 'default',
        binding = bindingKey,
        trusted = true,
        status = method === 'POST' ? 201 : 200,
      } = {}
    ) {
      const response = await fetch(
        origin +
          '/api/discussions' +
          suffix +
          '?' +
          new URLSearchParams({ bindingKey: binding }),
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': key,
            ...(trusted ? { 'X-Ingress-Auth': f.secret } : {}),
            'X-User-Id': user,
            'X-Anonymous': 'false',
            'X-User-Claims': JSON.stringify({ tenantId: tenant, roles: [] }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(15000),
        }
      );
      const value = await response.json();
      assert.equal(response.status, status, JSON.stringify(value));
      return value;
    }
    const origin = `http://127.0.0.1:${f.environment.DISCUSSION_PORT}`;
    async function projected(id, revision) {
      return until(
        async () => {
          const head = await heads.findOne({ _id: id });
          assert.equal(head?.revision, revision);
          assert.equal(
            await nodes.countDocuments({ discussionId: id }),
            head.nodeCount
          );
          return head;
        },
        'projection ' + revision,
        40000
      );
    }
    async function drain() {
      await until(
        async () => assert.equal(await pending(), 0),
        'outbox drain',
        40000
      );
      await queueEmpty();
    }
    async function committed(id) {
      const [node] = await rows(
        'SELECT * FROM discussion_write_nodes WHERE nodeId=?',
        [id]
      );
      const [registered] = await rows(
        'SELECT * FROM discussion_payload_objects WHERE objectKey=?',
        [node.payloadKey]
      );
      assert.equal(registered.state, 'committed');
      assert.equal(registered.tenantId, 'default');
      assert.equal(registered.ownerIdentityId, actor);
      const object = await s3.send(
        new GetObjectCommand({
          Bucket: 'discussion-content',
          Key: node.payloadKey,
        })
      );
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        node.payloadHash
      );
      assert.equal(bytes.length, node.payloadBytes);
      return { node, bytes };
    }
    async function kill(service, barrier, detail = {}) {
      await service.barrier(barrier);
      await service.stop('SIGKILL');
      observe('actual SIGKILL at ' + barrier, {
        signal: service.child.signalCode,
        ...detail,
      });
      return Date.now();
    }
    try {
      try {
        await require('./editorial-initialization-checks.cjs')(f);
      } catch (error) {
        initializationFailure = error;
        f.save('initialization-failure.json', {
          name: error.name,
          message: error.message,
          rootCauseOfI28Established: false,
        });
      }
      await launch('discussion-migrate', ownerBundle, ['--migrate']).finish();
      parent = createServer((request, response) => {
        const good =
          parentVisible &&
          request.url === '/api/catalog/application-visibility/' + parentId;
        response.writeHead(good ? 200 : 404, {
          'Content-Type': 'application/json',
        });
        response.end(
          JSON.stringify(
            good ? { id: parentId, tenantId: 'default', revision: 1 } : {}
          )
        );
      });
      await new Promise((resolve) => parent.listen(0, '127.0.0.1', resolve));
      f.environment.EDITORIAL_URL = `http://127.0.0.1:${parent.address().port}`;
      await startOwner();
      await startWorker();
      const base = await call('', {
        method: 'POST',
        body: requestBody('baseline'),
      });
      await projected(base.id, 1);
      assert.equal(
        (
          await rows(
            'SELECT bindingKey FROM discussion_write_aggregates WHERE id=?',
            [base.id]
          )
        )[0].bindingKey,
        bindingKey
      );
      assert.equal(
        (await heads.findOne({ _id: base.id })).bindingKey,
        bindingKey
      );
      await drain();
      const beforeDenial = await rows(
        'SELECT COUNT(*) n FROM discussion_commands'
      );
      await call('', {
        method: 'POST',
        body: requestBody('forged'),
        trusted: false,
        status: 401,
      });
      await call('', {
        method: 'POST',
        body: requestBody('foreign'),
        tenant: 'other',
        status: 404,
      });
      await call('/' + base.id, {
        binding: 'application:' + randomUUID(),
        status: 404,
      });
      await call('/' + base.id, {
        method: 'PUT',
        body: {
          content: topic('peer'),
          expectedRevision: 1,
        },
        user: peer,
        status: 403,
      });
      parentVisible = false;
      await call('', {
        method: 'POST',
        body: requestBody('revoked'),
        status: 404,
      });
      parentVisible = true;
      await sql.query(
        'INSERT INTO identity_erasure_barriers (identityId, erasureRevision, requestedAt) VALUES (?, 1, ?)',
        [erased, Date.now()]
      );
      await call('', {
        method: 'POST',
        body: requestBody('erased'),
        user: erased,
        status: 403,
      });
      assert.deepEqual(
        await rows('SELECT COUNT(*) n FROM discussion_commands'),
        beforeDenial
      );
      observe(
        'generic owner HTTP preserves exact consumer key, tenant, ownership, parent authority, forged-header denial and canonical erasure fence'
      );

      for (const mode of [
        'object-after-upload',
        'sql-before-commit',
        'sql-after-commit',
      ]) {
        await owner.arm(mode);
        const key = randomUUID(),
          body = requestBody(mode);
        const beforeCommands = (
          await rows('SELECT COUNT(*) n FROM discussion_commands')
        )[0].n;
        const request = call('', { method: 'POST', body, key }).then(
          (value) => ({ value }),
          () => ({ disconnected: true })
        );
        await owner.barrier(mode);
        const receipts = await rows(
          'SELECT * FROM discussion_commands WHERE commandKey=?',
          [key]
        );
        assert.equal(receipts.length, mode === 'sql-after-commit' ? 1 : 0);
        const reservations = await rows(
          "SELECT * FROM discussion_payload_objects WHERE state <> 'committed'"
        );
        if (mode !== 'sql-after-commit') {
          assert.ok(reservations.length > 0);
          const latest = reservations.toSorted(
            (a, b) => Number(b.registeredAt) - Number(a.registeredAt)
          )[0];
          const object = await s3.send(
            new GetObjectCommand({
              Bucket: 'discussion-content',
              Key: latest.objectKey,
            })
          );
          assert.equal(
            (await object.Body.transformToByteArray()).length,
            latest.bytes
          );
        }
        const restartedAt = await kill(owner, mode);
        assert.equal(
          (await request).disconnected,
          true,
          'No successful HTTP response before the killed window'
        );
        await startOwner(false);
        const replay = await call('', { method: 'POST', body, key });
        if (receipts.length) assert.equal(replay.id, receipts[0].nodeId);
        assert.equal(
          (await rows('SELECT COUNT(*) n FROM discussion_commands'))[0].n,
          beforeCommands + 1
        );
        assert.deepEqual(await call('', { method: 'POST', body, key }), replay);
        assert.equal(
          (
            await rows(
              'SELECT COUNT(*) n FROM discussion_outbox WHERE discussionId=?',
              [replay.id]
            )
          )[0].n,
          1
        );
        await committed(replay.id);
        await projected(replay.id, 1);
        await drain();
        observe(
          mode +
            ' recovery: one committed receipt/object reference/visible aggregate',
          { recoveryMs: Date.now() - restartedAt, targetMs: 40000 }
        );
        await owner.stop();
        await startOwner();
      }

      for (const mode of ['outbox-after-claim', 'broker-after-confirm']) {
        await drain();
        await owner.arm(mode);
        const created = await call('', {
          method: 'POST',
          body: requestBody(mode),
        });
        await owner.barrier(mode);
        const [leased] = await rows(
          'SELECT * FROM discussion_outbox WHERE discussionId=?',
          [created.id]
        );
        assert.equal(leased.deliveredAt, null);
        assert.ok(leased.leaseToken);
        assert.ok(Number(leased.leasedUntil) > Date.now());
        if (mode === 'broker-after-confirm') await projected(created.id, 1);
        else assert.equal(await heads.countDocuments({ _id: created.id }), 0);
        const restartedAt = await kill(owner, mode);
        await startOwner(false);
        const [retained] = await rows(
          'SELECT * FROM discussion_outbox WHERE id=?',
          [leased.id]
        );
        assert.equal(retained.deliveredAt, null);
        assert.equal(retained.leaseToken, leased.leaseToken);
        await projected(created.id, 1);
        await drain();
        const [delivered] = await rows(
          'SELECT * FROM discussion_outbox WHERE id=?',
          [leased.id]
        );
        assert.ok(
          Number(delivered.deliveredAt) >= Number(leased.leasedUntil),
          'Natural 30-second lease expiry; no test clock or lease rewrite'
        );
        assert.equal(delivered.leaseToken, null);
        assert.equal(
          await nodes.countDocuments({ discussionId: created.id }),
          1
        );
        observe(
          mode +
            ' recovery after natural lease expiry and confirmed redelivery',
          {
            recoveryMs: Date.now() - restartedAt,
            targetMs: 40000,
            leaseMs: 30000,
          }
        );
        await owner.stop();
        await startOwner();
      }

      const threadKey = randomUUID(),
        threadBody = requestBody('projection windows');
      const thread = await call('', {
        method: 'POST',
        body: threadBody,
        key: threadKey,
      });
      await projected(thread.id, 1);
      await drain();
      let revision = 1;
      for (const mode of [
        'projection-after-nodes',
        'projection-after-head',
        'projection-before-ack',
      ]) {
        await worker.stop();
        await startWorker(mode);
        const changed = await call('/' + thread.id, {
          method: 'PUT',
          body: {
            content: topic(mode),
            expectedRevision: revision,
          },
        });
        revision++;
        assert.equal(changed.revision, revision);
        await worker.barrier(mode);
        const state = await until(async () => {
          const state = await f.queueState();
          assert.equal(state.messages_unacknowledged, 1);
          return state;
        }, 'unacknowledged projection window');
        assert.equal(
          (await nodes.findOne({ _id: thread.id })).revision,
          revision
        );
        assert.equal(
          (await heads.findOne({ _id: thread.id })).revision,
          mode === 'projection-after-nodes' ? revision - 1 : revision
        );
        const restartedAt = await kill(worker, mode, {
          unacknowledged: state.messages_unacknowledged,
        });
        await startWorker();
        await projected(thread.id, revision);
        await drain();
        assert.equal(
          await nodes.countDocuments({ discussionId: thread.id }),
          1
        );
        observe(
          mode +
            ' recovery: durable head converges before acknowledgement with one visible node',
          { recoveryMs: Date.now() - restartedAt, targetMs: 20000 }
        );
      }

      // A committed object temporarily unavailable is a real retry fault; the exact bytes are restored below.
      await worker.stop();
      await drainOutbox();
      const reference = await committed(thread.id);
      await s3.send(
        new DeleteObjectCommand({
          Bucket: 'discussion-content',
          Key: reference.node.payloadKey,
        })
      );
      const event = {
        meta: {
          id: randomUUID(),
          type: 'discussion.materialization.requested',
          version: 2,
          occurredAt: new Date().toISOString(),
          producer: { service: 'recovery-qualification' },
          correlation: { correlationId: thread.id },
          subject: { entityType: 'discussion', entityId: thread.id },
        },
        payload: { discussionId: thread.id, revision },
      };
      const bytes = Buffer.from(JSON.stringify(event));
      channel.sendToQueue(queue, bytes, { persistent: true });
      await channel.waitForConfirms();
      for (let attempt = 0; attempt < 4; attempt++) {
        await startWorker('payload-read-failure');
        await worker.barrier('payload-read-failure');
        assert.equal(
          worker.messages.find((m) => m.delivery)?.delivery.count,
          attempt
        );
        await kill(worker, 'payload-read-failure', {
          durableDeliveryCount: attempt,
        });
      }
      await startWorker();
      const failed = await until(async () => {
        const message = await channel.get(failedQueue, { noAck: false });
        assert.ok(message);
        return message;
      }, 'durable retry quarantine');
      assert.deepEqual(failed.content, bytes);
      assert.equal(failed.properties.headers['x-wapps-attempts'], 5);
      assert.equal(
        failed.properties.headers['x-wapps-failure'],
        'MaterializationFailed'
      );
      await s3.send(
        new PutObjectCommand({
          Bucket: 'discussion-content',
          Key: reference.node.payloadKey,
          Body: reference.bytes,
          IfNoneMatch: '*',
        })
      );
      channel.sendToQueue(queue, failed.content, { persistent: true });
      await channel.waitForConfirms();
      channel.ack(failed);
      await projected(thread.id, revision);
      await queueEmpty();
      observe(
        'quorum delivery count survives four actual crashes; bounded retry quarantine retains exact bytes; explicit object repair and confirmed requeue recover'
      );

      await worker.stop();
      await startWorker('poison-after-confirm');
      const malformed = Buffer.from('{qualification-poison');
      channel.sendToQueue(queue, malformed, { persistent: true });
      await channel.waitForConfirms();
      await worker.barrier('poison-after-confirm');
      await until(async () => {
        const state = await f.queueState();
        assert.equal(state.messages_unacknowledged, 1);
      }, 'source poison remains unacknowledged');
      const poisonCopy = await channel.get(failedQueue, { noAck: false });
      assert.ok(poisonCopy);
      assert.deepEqual(poisonCopy.content, malformed);
      channel.nack(poisonCopy, false, true);
      await kill(worker, 'poison-after-confirm');
      await startWorker();
      await queueEmpty();
      const poisonCopies = [];
      while (true) {
        const message = await channel.get(failedQueue, { noAck: false });
        if (!message) break;
        assert.deepEqual(message.content, malformed);
        poisonCopies.push(message);
        channel.ack(message);
      }
      assert.ok(poisonCopies.length >= 1 && poisonCopies.length <= 2);
      observe(
        'poison transfer confirm precedes source acknowledgement; crash retains poison (possible duplicate quarantine copies); explicit test-owned operator removal',
        { retainedCopies: poisonCopies.length }
      );

      // Hold a genuinely old projection after its durable nodes but before its head, delete and publish newer state.
      await worker.stop();
      await startWorker('projection-after-nodes');
      await call('/' + thread.id, {
        method: 'PUT',
        body: {
          content: topic('stale'),
          expectedRevision: revision,
        },
      });
      revision++;
      await worker.barrier('projection-after-nodes');
      await call('/' + thread.id, {
        method: 'DELETE',
        body: { expectedRevision: revision },
      });
      revision++;
      const newerWorker = launch(
        'worker-newer-' + launchNumber++,
        workerBundle
      );
      await projected(thread.id, revision);
      assert.ok((await heads.findOne({ _id: thread.id })).deletedAt);
      const killedAt = await kill(worker, 'projection-after-nodes', {
        staleRevision: revision - 1,
        tombstoneRevision: revision,
      });
      worker = newerWorker;
      await drain();
      assert.equal(
        (await heads.findOne({ _id: thread.id })).revision,
        revision
      );
      assert.equal((await nodes.findOne({ _id: thread.id })).payload, null);
      await call('/' + thread.id, { status: 404 });
      const historicalRegistrations = await rows(
        'SELECT objectKey, state FROM discussion_payload_objects ORDER BY objectKey'
      );
      assert.deepEqual(
        await call('', { method: 'POST', body: threadBody, key: threadKey }),
        thread
      );
      assert.deepEqual(
        await rows(
          'SELECT objectKey, state FROM discussion_payload_objects ORDER BY objectKey'
        ),
        historicalRegistrations
      );
      assert.equal(
        (await heads.findOne({ _id: thread.id })).revision,
        revision
      );
      observe(
        'newer deletion survives killed stale materialization and redelivery without resurrection',
        { recoveryMs: Date.now() - killedAt, targetMs: 20000 }
      );

      await worker.stop();
      await owner.stop();
      const beforeHeads = await heads.find({}).sort({ _id: 1 }).toArray();
      const beforeNodes = await nodes.find({}).sort({ _id: 1 }).toArray();
      const receipts = await rows(
        'SELECT * FROM discussion_commands ORDER BY tenantId, actorIdentityId, commandKey'
      );
      const bindings = await rows(
        'SELECT id, tenantId, revision, bindingKey FROM discussion_write_aggregates ORDER BY id'
      );
      const payloads = await rows(
        'SELECT * FROM discussion_payload_objects ORDER BY objectKey'
      );
      await heads.drop();
      await nodes.drop();
      await channel.deleteQueue(queue);
      await channel.deleteQueue(failedQueue);
      await sql.query('DELETE FROM discussion_outbox');
      const rebuiltAt = Date.now();
      await launch('discussion-rebuild', workerBundle, ['--rebuild']).finish();
      await startOwner(false);
      await startWorker();
      await drain();
      assert.deepEqual(
        await heads.find({}).sort({ _id: 1 }).toArray(),
        beforeHeads
      );
      assert.deepEqual(
        await nodes.find({}).sort({ _id: 1 }).toArray(),
        beforeNodes
      );
      assert.deepEqual(
        await rows(
          'SELECT * FROM discussion_commands ORDER BY tenantId, actorIdentityId, commandKey'
        ),
        receipts
      );
      assert.deepEqual(
        await rows(
          'SELECT id, tenantId, revision, bindingKey FROM discussion_write_aggregates ORDER BY id'
        ),
        bindings
      );
      assert.deepEqual(
        await rows(
          'SELECT * FROM discussion_payload_objects ORDER BY objectKey'
        ),
        payloads
      );
      await launch('discussion-reconcile', workerBundle, [
        '--reconcile',
      ]).finish();
      const objects = await s3.send(
        new ListObjectsV2Command({ Bucket: 'discussion-content' })
      );
      assert.ok(
        objects.Contents.length >=
          payloads.filter((p) => p.state === 'committed').length
      );
      observe(
        'authoritative SQL/object rebuild with deleted Mongo collections, deleted queues and cleared delivery history reproduces exact projections, tombstones, keys, receipts and immutable registrations',
        {
          recoveryMs: Date.now() - rebuiltAt,
          targetMs: 40000,
          aggregates: bindings.length,
        }
      );
      f.save('qualification.json', {
        passed: !initializationFailure,
        discussionCrashRecoveryPassed: true,
        committedMutationLoss: 0,
        duplicateVisibleEffects: 0,
        prematureAcknowledgements: 0,
        resurrection: 0,
        initializationRootCause: 'unresolved',
        limits: [
          'One generic Discussion command family on fresh disposable stores',
          'Trusted ingress identity and consumer parent authority are controlled fixtures; real production OPA and canonical SQL erasure fences are exercised',
          'No full SQL/object backup restoration, compatible whole-service rollback, 24-hour soak or live activation',
        ],
      });
      if (initializationFailure) throw initializationFailure;
    } catch (error) {
      f.save('failure.json', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      throw error;
    } finally {
      if (parent) await new Promise((resolve) => parent.close(resolve));
      await f.cleanup();
    }
    async function drainOutbox() {
      await until(
        async () => assert.equal(await pending(), 0),
        'outbox drain before retry'
      );
    }
  }
);
