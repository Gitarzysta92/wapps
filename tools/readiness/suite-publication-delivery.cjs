const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const amqp = require('amqplib');
const { RabbitMqQueueClient } = require('@sdk/extras/queue-rabbitmq');
const { EDITORIAL_PROJECTION_QUEUE } = require('@apps/shared');
const base = '../../apps/services/editorial/src/app/';
const { DispatchEditorialOutbox } = require(base +
  'application/editorial-outbox');
const {
  consumeEditorialProjection,
  ensureEditorialProjectionQueues,
} = require(base + 'application/editorial-projection-consumer');
const { reconcileEditorialProjections } = require(base +
  'application/editorial-projection-recovery');
const { MysqlEditorialOutbox } = require(base +
  'infrastructure/mysql-editorial-outbox');
const { MysqlEditorialProjectionRecovery } = require(base +
  'infrastructure/mysql-editorial-projection-recovery');
const { SuiteWorkspace } = require(base + 'suites/suite-workspace');
const { MysqlSuiteWorkspace } = require(base + 'suites/mysql-suite-workspace');
const { SuitePublication } = require(base + 'suites/suite-publication');
const { MysqlSuitePublication } = require(base +
  'suites/mysql-suite-publication');
const { ApplicationDrafts } = require(base +
  'application-drafts/application-drafts');
const { MysqlApplicationDrafts } = require(base +
  'application-drafts/mysql-application-drafts');
const { ApplicationPublication } = require(base +
  'application-publication/application-publication');
const { MysqlApplicationPublication } = require(base +
  'application-publication/mysql-application-publication');

async function suitePublicationDelivery({
  source,
  reader,
  projections,
  collection,
  policy,
  port,
  password,
  applicationId,
  pass,
  kind = 'suite',
}) {
  const client = new RabbitMqQueueClient();
  let control;
  let channel;
  let failure;
  let failed = false;
  const cleanupFailures = [];
  try {
    const queue = await client.connect({
      host: '127.0.0.1',
      port: String(port),
      username: 'wapps',
      password,
      connectionTimeoutMs: 3000,
    });
    await ensureEditorialProjectionQueues(queue);
    control = await amqp.connect(
      `amqp://wapps:${encodeURIComponent(password)}@127.0.0.1:${port}/`,
      { timeout: 3000 }
    );
    control.on('error', () => undefined);
    channel = await control.createChannel();
    const events = [];
    const dispatcher = new DispatchEditorialOutbox(
      new MysqlEditorialOutbox(source),
      {
        publish: async (event) => {
          events.push(event);
          await queue.publishConfirmed(
            EDITORIAL_PROJECTION_QUEUE,
            Buffer.from(JSON.stringify(event))
          );
        },
      },
      randomUUID,
      () => Date.now() + 1000000
    );
    const consume = async (message, failAck = false) => {
      const receiving = channel;
      return consumeEditorialProjection(
        {
          content: message.content,
          headers: message.properties.headers,
          ack: () => {
            if (failAck)
              throw new Error('simulated process loss before acknowledgement');
            receiving.ack(message);
          },
          nack: (requeue = false) => receiving.nack(message, false, requeue),
        },
        queue,
        reader,
        projections,
        { wait: async () => undefined }
      );
    };
    const dispatch = async () => {
      for (let i = 0; i < 200; i++) {
        const outcome = await dispatcher.once();
        if (outcome === 'idle') return;
        assert.equal(outcome, 'delivered');
      }
      assert.fail('Outbox drain exceeded bound');
    };
    const drain = async () => {
      for (let i = 0; i < 200; i++) {
        const message = await channel.get(EDITORIAL_PROJECTION_QUEUE, {
          noAck: false,
        });
        if (!message) return;
        assert.equal(await consume(message), 'materialized');
      }
      assert.fail('Queue drain exceeded bound');
    };
    await dispatch();
    await drain();
    const owner = {
      identityId: 'DeliveryOwner',
      tenantId: 'default',
      roles: [],
    };
    const reviewer = {
      identityId: 'DeliveryReviewer',
      tenantId: 'default',
      roles: ['editorial:reviewer'],
    };
    const workspace =
      kind === 'app'
        ? new ApplicationDrafts(new MysqlApplicationDrafts(source), policy, {
            generate: randomUUID,
          })
        : new SuiteWorkspace(
            new MysqlSuiteWorkspace(source, 'default'),
            policy,
            { generate: randomUUID }
          );
    const publication =
      kind === 'app'
        ? new ApplicationPublication(
            new MysqlApplicationPublication(source),
            policy
          )
        : new SuitePublication(
            new MysqlSuitePublication(source, 'default'),
            policy
          );
    const created = await workspace.change(
      owner,
      'create',
      null,
      kind === 'app'
        ? {
            name: 'Delivery application',
            slug: 'delivery-application',
            website: 'https://example.test',
            description: 'An application for confirmed delivery and recovery.',
          }
        : {
            title: 'Delivery collection',
            description: '',
            applicationIds: [applicationId],
          },
      randomUUID()
    );
    const id = created.id;
    await publication.change(
      owner,
      id,
      'submit',
      { expectedRevision: 1 },
      randomUUID()
    );
    await publication.change(
      reviewer,
      id,
      'approve',
      { expectedRevision: 2, submittedRevision: 1 },
      randomUUID()
    );
    await dispatch();
    const message = await channel.get(EDITORIAL_PROJECTION_QUEUE, {
      noAck: false,
    });
    assert.ok(message);
    assert.equal(JSON.parse(message.content).payload.resourceId, id);
    await assert.rejects(consume(message, true), /process loss/);
    const original = await projections.find(kind, id);
    assert.equal(
      kind === 'app' ? original.content.name : original.content.title,
      kind === 'app' ? 'Delivery application' : 'Delivery collection'
    );
    await channel.close();
    channel = await control.createChannel();
    const redelivered = await channel.get(EDITORIAL_PROJECTION_QUEUE, {
      noAck: false,
    });
    assert.ok(redelivered.fields.redelivered);
    assert.equal(await consume(redelivered), 'materialized');
    const event = events.find((item) => item.payload.resourceId === id);
    for (let i = 0; i < 2; i++)
      await queue.publishConfirmed(
        EDITORIAL_PROJECTION_QUEUE,
        Buffer.from(JSON.stringify(event))
      );
    await drain();
    assert.deepEqual(await projections.find(kind, id), original);
    pass(
      `real confirmed broker delivery, redelivery after lost acknowledgement and duplicate ${kind} events converge`
    );

    if (kind === 'suite') {
      const { SuiteCatalog } = require(base + 'suites/suite-catalog');
      const { MysqlSuiteCatalog } = require(base +
        'suites/mysql-suite-catalog');
      const catalog = new SuiteCatalog(
        new MysqlSuiteCatalog(source, 'default'),
        projections
      );
      const [pointer] = await source.query(
        'SELECT * FROM suite_publications WHERE suiteId = ?',
        [id]
      );
      await source.query('DELETE FROM suite_publications WHERE suiteId = ?', [
        id,
      ]);
      await assert.rejects(catalog.find(id), /inconsistent/);
      await assert.rejects(catalog.browse({ q: '', page: 1 }), /inconsistent/);
      await source.query(
        'INSERT INTO suite_publications (suiteId, submittedRevision, publishedAt, title, description, applicationIds) VALUES (?, ?, ?, ?, ?, ?)',
        [
          id,
          pointer.submittedRevision,
          pointer.publishedAt,
          pointer.title,
          pointer.description,
          typeof pointer.applicationIds === 'string'
            ? pointer.applicationIds
            : JSON.stringify(pointer.applicationIds),
        ]
      );
      assert.equal((await catalog.find(id)).title, 'Delivery collection');
      pass(
        'missing authoritative publication relations fail explicitly instead of returning an empty catalog'
      );
    }

    await collection.deleteOne({ _id: `${kind}:${id}` });
    const report = await reconcileEditorialProjections(
      new MysqlEditorialProjectionRecovery(source),
      reader,
      projections,
      { apply: true }
    );
    assert.equal(report.failed, 0);
    assert.equal(report.conflicts, 0);
    assert.ok(report.queued >= 1);
    await dispatch();
    await drain();
    assert.deepEqual(await projections.find(kind, id), original);
    await publication.change(
      owner,
      id,
      'withdraw',
      { expectedRevision: 3 },
      randomUUID()
    );
    await queue.publishConfirmed(
      EDITORIAL_PROJECTION_QUEUE,
      Buffer.from(JSON.stringify(event))
    );
    await dispatch();
    await drain();
    const withdrawn = await projections.find(kind, id);
    assert.equal(withdrawn.revision, 2);
    assert.equal(withdrawn.content, null);
    assert.equal(await projections.publish(original), 'superseded');
    pass(
      `${kind} projection loss rebuilds from SQL through the broker; out-of-order publication cannot overwrite withdrawal`
    );
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    if (channel) {
      try {
        await channel.close();
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    const results = await Promise.allSettled([
      control?.close(),
      client.close(),
    ]);
    const failures = results.filter((result) => result.status === 'rejected');
    cleanupFailures.push(...failures.map((result) => result.reason));
  }
  if (failed || cleanupFailures.length)
    throw new AggregateError(
      [...(failed ? [failure] : []), ...cleanupFailures],
      `${kind} broker qualification failed`
    );
}
module.exports = { suitePublicationDelivery };
