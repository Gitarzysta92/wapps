import { PlatformMongoClient } from '@sdk/extras/mongo';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';
import { MysqlClient } from '@sdk/extras/mysql';
import { MinioClient } from '@sdk/extras/minio';
import {
  DISCUSSION_GENERATION_QUEUE_NAME,
  DiscussionGenerationHead,
  DiscussionGenerationNode,
} from '@apps/shared';
import { MysqlDiscussionSnapshotReader } from './mysql-snapshot-reader';
import { MinioImmutablePayloadReader } from './immutable-payload-reader';
import { MongoGenerationStore } from './mongo-generation-store';
import { enqueueDiscussionRebuildPage } from './rebuild';
import { reconcileDiscussions } from './reconciliation';
import { MysqlDiscussionReconciliationSource } from './mysql-reconciliation-source';
import { MongoGenerationInspector } from './mongo-generation-inspector';
import {
  consumeGeneration,
  ensureGenerationQueues,
} from './generation-consumer';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
}

async function run(): Promise<void> {
  const mongo = new PlatformMongoClient();
  const broker = new RabbitMqQueueClient();
  const mysql = new MysqlClient();
  const abort = new AbortController();
  const active = new Set<Promise<unknown>>();
  let stopped: () => void = () => undefined;
  const stopRequested = new Promise<void>((resolve) => {
    stopped = resolve;
  });
  const stop = () => {
    abort.abort();
    stopped();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await mongo.connect({
      host: required('MONGO_HOST'),
      port: required('MONGO_PORT'),
      username: required('MONGO_USERNAME'),
      password: required('MONGO_PASSWORD'),
      database: required('MONGO_DATABASE'),
    });
    const pool = mysql.connect({
      host: required('MYSQL_HOST'),
      port: Number(required('MYSQL_PORT')),
      user: required('MYSQL_USERNAME'),
      password: required('MYSQL_PASSWORD'),
      database: required('MYSQL_DATABASE'),
    });
    await pool.query('SELECT 1');
    const minio = new MinioClient({
      host: required('DISCUSSION_STORAGE_HOST'),
      accessKey: required('DISCUSSION_STORAGE_ACCESSKEY'),
      secretKey: required('DISCUSSION_STORAGE_SECRETKEY'),
    });
    const queue = await broker.connect({
      host: required('QUEUE_HOST'),
      port: required('QUEUE_PORT'),
      username: required('QUEUE_USERNAME'),
      password: required('QUEUE_PASSWORD'),
    });
    const reader = new MysqlDiscussionSnapshotReader(pool);
    const payloads = new MinioImmutablePayloadReader(minio);
    const store = new MongoGenerationStore(
      mongo.collection<DiscussionGenerationNode>('discussion_generation_nodes'),
      mongo.collection<DiscussionGenerationHead>('discussion_generation_heads')
    );
    await store.ensureIndexes();
    await ensureGenerationQueues(queue);
    await queue.prefetch(1);
    const failed = () => {
      process.exitCode = 1;
      stop();
    };
    void queue.closed.then(() => {
      if (!abort.signal.aborted) failed();
    });
    await queue.consume(
      DISCUSSION_GENERATION_QUEUE_NAME,
      (message) => {
        if (!message) {
          failed();
          return;
        }
        const work = consumeGeneration(
          message,
          queue,
          reader,
          payloads,
          store,
          { signal: abort.signal }
        )
          .then((outcome) => {
            if (outcome === 'dead-lettered')
              console.error(
                'Materialization request moved to the failed queue'
              );
          })
          .catch(() => {
            if (!abort.signal.aborted)
              console.error(
                'Materializer stopped with unfinished delivery; broker will redeliver'
              );
            failed();
          });
        active.add(work);
        void work.finally(() => active.delete(work));
      },
      { noAck: false }
    );
    await stopRequested;
  } finally {
    abort.abort();
    await Promise.allSettled(active);
    await Promise.allSettled([broker.close(), mysql.close(), mongo.close()]);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

async function rebuild(): Promise<void> {
  const mysql = new MysqlClient();
  try {
    const pool = mysql.connect({
      host: required('MYSQL_HOST'),
      port: Number(required('MYSQL_PORT')),
      user: required('MYSQL_USERNAME'),
      password: required('MYSQL_PASSWORD'),
      database: required('MYSQL_DATABASE'),
    });
    let afterId = '';
    let total = 0;
    while (true) {
      const page = await enqueueDiscussionRebuildPage(pool, afterId);
      total += page.queued;
      console.log(
        `Discussion rebuild: ${total} authoritative aggregates queued`
      );
      if (page.queued === 0) break;
      afterId = page.nextId;
    }
  } finally {
    await mysql.close();
  }
}

async function reconcile(apply: boolean): Promise<void> {
  const mysql = new MysqlClient();
  const mongo = new PlatformMongoClient();
  try {
    const pool = mysql.connect({
      host: required('MYSQL_HOST'),
      port: Number(required('MYSQL_PORT')),
      user: required('MYSQL_USERNAME'),
      password: required('MYSQL_PASSWORD'),
      database: required('MYSQL_DATABASE'),
    });
    await mongo.connect({
      host: required('MONGO_HOST'),
      port: required('MONGO_PORT'),
      username: required('MONGO_USERNAME'),
      password: required('MONGO_PASSWORD'),
      database: required('MONGO_DATABASE'),
    });
    const report = await reconcileDiscussions(
      new MysqlDiscussionReconciliationSource(pool),
      new MongoGenerationInspector(
        mongo.collection<DiscussionGenerationNode>(
          'discussion_generation_nodes'
        ),
        mongo.collection<DiscussionGenerationHead>(
          'discussion_generation_heads'
        )
      ),
      {
        apply,
        onResult: (discussionId, condition, queued) =>
          console.log(JSON.stringify({ discussionId, condition, queued })),
      }
    );
    console.log(
      JSON.stringify({ mode: apply ? 'requeue' : 'inspect', ...report })
    );
    if (report.failed || report.conflicts) process.exitCode = 1;
    else if (report.changed || (!apply && report.needsRebuild))
      process.exitCode = 2;
  } finally {
    await Promise.allSettled([mysql.close(), mongo.close()]);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (!args.length) return run();
  if (args.length === 1 && args[0] === '--rebuild') return rebuild();
  if (
    args[0] === '--reconcile' &&
    (args.length === 1 || (args.length === 2 && args[1] === '--apply'))
  )
    return reconcile(args.length === 2);
  throw new Error('Expected --rebuild or --reconcile [--apply]');
}

void main().catch((error) => {
  console.error(
    'Discussion materializer failed to start:',
    error instanceof Error ? error.name : 'Unknown error'
  );
  process.exitCode = 1;
});
