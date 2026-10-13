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

async function articlePublicationDelivery({
  source,
  reader,
  projections,
  collection,
  port,
  password,
  id,
  withdraw,
  pass,
}) {
  const client = new RabbitMqQueueClient();
  let control, channel;
  const failures = [];
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
    async function dispatch() {
      for (let n = 0; n < 200; n++) {
        const result = await dispatcher.once();
        if (result === 'idle') return;
        assert.equal(result, 'delivered');
      }
      assert.fail('Article outbox drain exceeded its bound');
    }
    async function consume(message, loseAck = false) {
      const receiving = channel;
      return consumeEditorialProjection(
        {
          content: message.content,
          headers: message.properties.headers,
          ack: () => {
            if (loseAck)
              throw new Error('Simulated loss before acknowledgement');
            receiving.ack(message);
          },
          nack: (requeue = false) => receiving.nack(message, false, requeue),
        },
        queue,
        reader,
        projections,
        { wait: async () => undefined }
      );
    }
    async function drain() {
      for (let n = 0; n < 200; n++) {
        const message = await channel.get(EDITORIAL_PROJECTION_QUEUE, {
          noAck: false,
        });
        if (!message) return;
        assert.equal(await consume(message), 'materialized');
      }
      assert.fail('Article queue drain exceeded its bound');
    }
    await dispatch();
    await drain();
    const event = events.find(
      (value) =>
        value.payload.kind === 'article' && value.payload.resourceId === id
    );
    assert.ok(event, 'A committed article must dispatch a real broker event');
    const original = await projections.find('article', id);
    assert.ok(original.content);
    await queue.publishConfirmed(
      EDITORIAL_PROJECTION_QUEUE,
      Buffer.from(JSON.stringify(event))
    );
    const message = await channel.get(EDITORIAL_PROJECTION_QUEUE, {
      noAck: false,
    });
    assert.ok(message);
    await assert.rejects(consume(message, true), /Simulated loss/);
    await channel.close();
    channel = await control.createChannel();
    const redelivered = await channel.get(EDITORIAL_PROJECTION_QUEUE, {
      noAck: false,
    });
    assert.ok(redelivered);
    assert.equal(redelivered.fields.redelivered, true);
    assert.equal(await consume(redelivered), 'materialized');
    assert.deepEqual(await projections.find('article', id), original);
    await collection.deleteOne({ _id: `article:${id}` });
    const report = await reconcileEditorialProjections(
      new MysqlEditorialProjectionRecovery(source),
      reader,
      projections,
      { apply: true }
    );
    assert.equal(report.failed, 0);
    assert.equal(report.conflicts, 0);
    assert.ok(report.queued > 0);
    await dispatch();
    await drain();
    assert.deepEqual(await projections.find('article', id), original);
    await withdraw();
    await queue.publishConfirmed(
      EDITORIAL_PROJECTION_QUEUE,
      Buffer.from(JSON.stringify(event))
    );
    await dispatch();
    await drain();
    const tombstone = await projections.find('article', id);
    assert.equal(tombstone.content, null);
    assert.ok(tombstone.revision > original.revision);
    assert.equal(await projections.publish(original), 'superseded');
    pass(
      'real broker confirms, redelivery after lost acknowledgement, SQL reconciliation and old article events converge without resurrection'
    );
  } catch (error) {
    failures.push(error);
  } finally {
    const cleanup = await Promise.allSettled([
      channel?.close(),
      client.close(),
    ]);
    for (const result of cleanup)
      if (result.status === 'rejected') failures.push(result.reason);
    try {
      await control?.close();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, 'Article broker qualification failed');
}
module.exports = { articlePublicationDelivery };
