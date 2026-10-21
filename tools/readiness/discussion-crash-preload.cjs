/* Test-only IPC barriers around external drivers used by the compiled production bundles. */
const { MysqlQueryRunner } = require('typeorm/driver/mysql/MysqlQueryRunner');
const { S3Client } = require('@aws-sdk/client-s3');
const { Collection } = require('mongodb');
const { ConfirmChannel } = require('amqplib/lib/channel_model');
let mode;
let hit = false;
process.on('message', (message) => {
  if (message?.arm) {
    mode = message.arm;
    hit = false;
    process.send({ armed: mode });
  }
});
process.channel?.unref();
function matches(name) {
  return mode === name && !hit;
}
function reached(name) {
  hit = true;
  process.send({ barrier: name });
  return new Promise(() => undefined);
}
const mutation = new WeakSet(),
  claim = new WeakSet();
const query = MysqlQueryRunner.prototype.query;
MysqlQueryRunner.prototype.query = async function (sql, ...args) {
  const result = await query.call(this, sql, ...args);
  if (/^INSERT INTO discussion_commands\b/.test(sql)) mutation.add(this);
  if (/^UPDATE discussion_outbox SET leaseToken\b/.test(sql)) claim.add(this);
  return result;
};
const commit = MysqlQueryRunner.prototype.commitTransaction;
MysqlQueryRunner.prototype.commitTransaction = async function (...args) {
  const changed = mutation.has(this),
    claimed = claim.has(this);
  mutation.delete(this);
  claim.delete(this);
  if (changed && matches('sql-before-commit'))
    await reached('sql-before-commit');
  const result = await commit.apply(this, args);
  if (changed && matches('sql-after-commit')) await reached('sql-after-commit');
  if (claimed && matches('outbox-after-claim'))
    await reached('outbox-after-claim');
  return result;
};
const send = S3Client.prototype.send;
S3Client.prototype.send = async function (command, ...args) {
  let result;
  try {
    result = await send.call(this, command, ...args);
  } catch (error) {
    if (
      command.constructor.name === 'GetObjectCommand' &&
      matches('payload-read-failure')
    )
      await reached('payload-read-failure');
    throw error;
  }
  if (
    command.constructor.name === 'PutObjectCommand' &&
    matches('object-after-upload')
  )
    await reached('object-after-upload');
  return result;
};
const bulk = Collection.prototype.bulkWrite;
Collection.prototype.bulkWrite = async function (...args) {
  const result = await bulk.apply(this, args);
  if (
    this.collectionName === 'discussion_generation_nodes' &&
    matches('projection-after-nodes')
  )
    await reached('projection-after-nodes');
  return result;
};
for (const operation of ['updateOne', 'insertOne']) {
  const original = Collection.prototype[operation];
  Collection.prototype[operation] = async function (...args) {
    const result = await original.apply(this, args);
    if (
      this.collectionName === 'discussion_generation_heads' &&
      (operation === 'insertOne' || result.matchedCount === 1) &&
      matches('projection-after-head')
    )
      await reached('projection-after-head');
    return result;
  };
}
const publish = ConfirmChannel.prototype.sendToQueue;
ConfirmChannel.prototype.sendToQueue = function (
  queue,
  body,
  options,
  callback
) {
  return publish.call(this, queue, body, options, (error, ...args) => {
    const name = queue.endsWith('.failed')
      ? 'poison-after-confirm'
      : 'broker-after-confirm';
    if (!error && matches(name)) {
      void reached(name);
      return;
    }
    callback(error, ...args);
  });
};
const ack = ConfirmChannel.prototype.ack;
ConfirmChannel.prototype.ack = function (...args) {
  if (matches('projection-before-ack')) {
    void reached('projection-before-ack');
    return;
  }
  return ack.apply(this, args);
};
const consume = ConfirmChannel.prototype.consume;
ConfirmChannel.prototype.consume = function (queue, callback, ...args) {
  return consume.call(
    this,
    queue,
    (message) => {
      if (message)
        process.send({
          delivery: {
            count: message.properties.headers?.['x-delivery-count'] ?? 0,
            redelivered: message.fields.redelivered,
          },
        });
      callback(message);
    },
    ...args
  );
};
