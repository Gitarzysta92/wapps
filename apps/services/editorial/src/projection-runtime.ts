import { PlatformMongoClient } from '@sdk/extras/mongo';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';
import { EDITORIAL_PROJECTION_QUEUE, EditorialProjection } from '@apps/shared';
import {
  editorialMaintenanceSource,
  EditorialMaintenanceInputError,
} from './maintenance';
import { MysqlEditorialSnapshotReader } from './app/infrastructure/mysql-editorial-snapshot';
import {
  MongoEditorialProjections,
  EDITORIAL_PROJECTION_COLLECTION,
} from './app/infrastructure/mongo-editorial-projections';
import {
  consumeEditorialProjection,
  ensureEditorialProjectionQueues,
} from './app/application/editorial-projection-consumer';
import { MysqlEditorialProjectionRecovery } from './app/infrastructure/mysql-editorial-projection-recovery';
import { reconcileEditorialProjections } from './app/application/editorial-projection-recovery';

export { EDITORIAL_PROJECTION_COLLECTION } from './app/infrastructure/mongo-editorial-projections';

type Environment = Record<string, string | undefined>;

function required(environment: Environment, name: string): string {
  const value = environment[name];
  if (!value) throw new EditorialMaintenanceInputError(`Missing ${name}`);
  return value;
}

async function connectMongo(
  mongo: PlatformMongoClient,
  environment: Environment
): Promise<MongoEditorialProjections> {
  await mongo.connect({
    host: required(environment, 'MONGO_HOST'),
    port: required(environment, 'MONGO_PORT'),
    username: required(environment, 'MONGO_USERNAME'),
    password: required(environment, 'MONGO_PASSWORD'),
    database: required(environment, 'MONGO_DATABASE'),
    options: {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 30_000,
    },
  });
  return new MongoEditorialProjections(
    mongo.collection<EditorialProjection>(EDITORIAL_PROJECTION_COLLECTION)
  );
}

export async function runEditorialMaterializer(
  environment: Environment = process.env
): Promise<void> {
  const source = editorialMaintenanceSource(environment);
  const mongo = new PlatformMongoClient();
  const broker = new RabbitMqQueueClient();
  const abort = new AbortController();
  const active = new Set<Promise<void>>();
  let stopped: () => void = () => undefined;
  const stopRequested = new Promise<void>((resolve) => {
    stopped = resolve;
  });
  const stop = () => {
    abort.abort();
    stopped();
  };
  const failed = () => {
    process.exitCode = 1;
    stop();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await source.initialize();
    // Refuse to consume before the authoritative migration has been installed.
    await source.query(
      'SELECT resourceKind, resourceId, tenantId, revision, deletedAt FROM editorial_resource_states LIMIT 0'
    );
    if (abort.signal.aborted) return;
    const projections = await connectMongo(mongo, environment);
    await projections.ensureIndexes();
    if (abort.signal.aborted) return;
    const reader = new MysqlEditorialSnapshotReader(
      source,
      environment.EDITORIAL_PUBLIC_TENANT ?? 'default'
    );
    const queue = await broker.connect({
      host: required(environment, 'QUEUE_HOST'),
      port: environment.QUEUE_PORT ?? '5672',
      username: required(environment, 'QUEUE_USERNAME'),
      password: required(environment, 'QUEUE_PASSWORD'),
      vhost: environment.QUEUE_VHOST,
    });
    await ensureEditorialProjectionQueues(queue);
    if (abort.signal.aborted) return;
    await queue.prefetch(1);
    void queue.closed.then(() => {
      if (!abort.signal.aborted) failed();
    });
    await queue.consume(
      EDITORIAL_PROJECTION_QUEUE,
      (message) => {
        if (!message) {
          if (!abort.signal.aborted) failed();
          return;
        }
        const work = consumeEditorialProjection(
          message,
          queue,
          reader,
          projections,
          { signal: abort.signal }
        )
          .then((outcome) => {
            if (outcome === 'dead-lettered')
              console.error(
                'Editorial projection request retained in the failed queue'
              );
          })
          .catch(() => {
            if (!abort.signal.aborted) {
              console.error(
                'Editorial materializer stopped with unfinished delivery; broker will redeliver'
              );
              failed();
            }
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
    await Promise.allSettled([
      broker.close(),
      mongo.close(),
      ...(source.isInitialized ? [source.destroy()] : []),
    ]);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

export async function runEditorialReconciliation(
  apply: boolean,
  environment: Environment = process.env
): Promise<void> {
  const source = editorialMaintenanceSource(environment);
  const mongo = new PlatformMongoClient();
  try {
    await source.initialize();
    const projections = await connectMongo(mongo, environment);
    const report = await reconcileEditorialProjections(
      new MysqlEditorialProjectionRecovery(source),
      new MysqlEditorialSnapshotReader(
        source,
        environment.EDITORIAL_PUBLIC_TENANT ?? 'default'
      ),
      projections,
      { apply, onResult: (result) => console.log(JSON.stringify(result)) }
    );
    console.log(
      JSON.stringify({ mode: apply ? 'requeue' : 'inspect', ...report })
    );
    if (report.failed || report.conflicts) process.exitCode = 1;
    else if (report.changed || (!apply && report.needsRebuild))
      process.exitCode = 2;
  } finally {
    await Promise.allSettled([
      mongo.close(),
      ...(source.isInitialized ? [source.destroy()] : []),
    ]);
  }
}
