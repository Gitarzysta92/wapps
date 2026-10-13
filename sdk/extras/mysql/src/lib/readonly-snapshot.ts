import type { DataSource } from 'typeorm';

export interface MysqlSnapshotReader {
  query<T extends Record<string, unknown>>(
    sql: string,
    parameters?: unknown[]
  ): Promise<T[]>;
}

function connectionCloser(connection: unknown): () => void {
  if (
    !connection ||
    typeof connection !== 'object' ||
    !('destroy' in connection) ||
    typeof connection.destroy !== 'function'
  )
    throw new Error('MySQL snapshot requires a cancellable connection');
  const destroy = connection.destroy.bind(connection);
  return () => {
    destroy();
  };
}

/** Each stream owns one read-only consistent snapshot and releases it on early return. */
export async function* readonlyMysqlSnapshot<T>(
  source: DataSource,
  signal: AbortSignal,
  read: (reader: MysqlSnapshotReader) => AsyncIterable<T>,
  timeoutMs = 300_000
): AsyncIterable<T> {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000)
    throw new Error('Invalid MySQL snapshot timeout');
  const runner = source.createQueryRunner();
  const controller = new AbortController();
  let close: (() => void) | undefined,
    destroyed = false,
    complete = false;
  const destroy = () => {
    if (close && !destroyed) {
      destroyed = true;
      close();
    }
  };
  const cancel = () => {
    controller.abort(signal.reason);
    destroy();
  };
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const timeout = setTimeout(() => {
    controller.abort(new Error('MySQL snapshot timed out'));
    destroy();
  }, timeoutMs);
  const pending = async <R>(operation: Promise<R>): Promise<R> => {
    const current = controller.signal;
    let abort: () => void = () => undefined;
    const aborted = new Promise<never>((_, reject) => {
      abort = () => reject(current.reason);
      current.addEventListener('abort', abort, { once: true });
      if (current.aborted) abort();
    });
    try {
      return await Promise.race([operation, aborted]);
    } finally {
      current.removeEventListener('abort', abort);
    }
  };
  try {
    await pending(
      runner.connect().then((connection) => {
        close = connectionCloser(connection);
        if (controller.signal.aborted) {
          destroy();
          controller.signal.throwIfAborted();
        }
      })
    );
    await pending(runner.query('SET TRANSACTION READ ONLY'));
    await pending(runner.startTransaction('REPEATABLE READ'));
    const reader: MysqlSnapshotReader = {
      async query<R extends Record<string, unknown>>(
        sql: string,
        parameters: unknown[] = []
      ): Promise<R[]> {
        controller.signal.throwIfAborted();
        if (!/^SELECT\s/i.test(sql) || parameters.length > 256)
          throw new Error('Snapshot queries must be bounded SELECT statements');
        const bounded = sql.replace(
          /^SELECT\s/i,
          'SELECT /*+ MAX_EXECUTION_TIME(3000) */ '
        );
        return pending(runner.query(bounded, parameters));
      },
    };
    const iterator = read(reader)[Symbol.asyncIterator]();
    let finished = false;
    try {
      for (;;) {
        const result = await pending(iterator.next());
        if (result.done) {
          finished = true;
          break;
        }
        controller.signal.throwIfAborted();
        yield result.value;
      }
    } finally {
      if (!finished) void iterator.return?.().catch(() => undefined);
    }
    await pending(runner.commitTransaction());
    complete = true;
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
    // Destroying an unfinished read rolls back without returning a busy connection to the pool.
    if (!complete) destroy();
    await runner.release();
  }
}
