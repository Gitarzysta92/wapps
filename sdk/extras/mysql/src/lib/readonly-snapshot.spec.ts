import type { DataSource } from 'typeorm';
import { readonlyMysqlSnapshot } from './readonly-snapshot';

function fixture() {
  const connection = { destroy: jest.fn() };
  const runner = {
    connect: jest.fn().mockResolvedValue(connection),
    query: jest.fn().mockResolvedValue([{ id: 'owned' }]),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const source = { createQueryRunner: () => runner } as unknown as DataSource;
  return { source, runner, connection, controller: new AbortController() };
}
async function collect<T>(input: AsyncIterable<T>): Promise<T[]> {
  const output: T[] = [];
  for await (const row of input) output.push(row);
  return output;
}
describe('read-only MySQL snapshot streams', () => {
  it('keeps all reads in one bounded read-only transaction and commits before completion', async () => {
    const f = fixture();
    const rows = await collect(
      readonlyMysqlSnapshot(
        f.source,
        f.controller.signal,
        async function* (reader) {
          yield* await reader.query('SELECT id FROM owned WHERE owner = ?', [
            'Owner',
          ]);
          expect(f.runner.commitTransaction).not.toHaveBeenCalled();
          yield* await reader.query(
            'SELECT id FROM owned WHERE owner = ? AND id > ?',
            ['Owner', 'owned']
          );
        }
      )
    );
    expect(rows).toEqual([{ id: 'owned' }, { id: 'owned' }]);
    expect(f.runner.query.mock.calls[0]).toEqual(['SET TRANSACTION READ ONLY']);
    expect(f.runner.startTransaction).toHaveBeenCalledWith('REPEATABLE READ');
    expect(f.runner.query.mock.calls[1]).toEqual([
      'SELECT /*+ MAX_EXECUTION_TIME(3000) */ id FROM owned WHERE owner = ?',
      ['Owner'],
    ]);
    expect(f.runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(f.runner.release).toHaveBeenCalledTimes(1);
    expect(f.connection.destroy).not.toHaveBeenCalled();
  });
  it('closes the transaction when a consumer stops early', async () => {
    const f = fixture();
    for await (const row of readonlyMysqlSnapshot(
      f.source,
      f.controller.signal,
      async function* () {
        yield 1;
        yield 2;
      }
    )) {
      expect(row).toBe(1);
      break;
    }
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    expect(f.runner.release).toHaveBeenCalledTimes(1);
    expect(f.runner.commitTransaction).not.toHaveBeenCalled();
  });
  it('rejects writes inside a snapshot', async () => {
    const f = fixture();
    await expect(
      collect(
        readonlyMysqlSnapshot(
          f.source,
          f.controller.signal,
          async function* (reader) {
            yield* await reader.query('DELETE FROM owned');
          }
        )
      )
    ).rejects.toThrow('SELECT');
    expect(f.runner.query).toHaveBeenCalledTimes(1);
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
  });
  it.each(['query', 'processing'])(
    'aborts stalled %s and destroys only its own connection',
    async (stage) => {
      const f = fixture();
      const rows = collect(
        readonlyMysqlSnapshot(
          f.source,
          f.controller.signal,
          async function* (reader) {
            if (stage === 'query') {
              f.runner.query.mockImplementation(
                () => new Promise(() => undefined)
              );
              yield* await reader.query('SELECT id FROM owned');
            } else {
              await new Promise(() => undefined);
              yield 1;
            }
          }
        )
      );
      const rejected = expect(rows).rejects.toThrow('cancel capture');
      await new Promise((resolve) => setImmediate(resolve));
      f.controller.abort(new Error('cancel capture'));
      await rejected;
      expect(f.connection.destroy).toHaveBeenCalledTimes(1);
      expect(f.runner.release).toHaveBeenCalledTimes(1);
      expect(f.runner.commitTransaction).not.toHaveBeenCalled();
    }
  );
  it('destroys a late pool acquisition after cancellation', async () => {
    const f = fixture();
    let acquired: (connection: unknown) => void = () => undefined;
    f.runner.connect.mockImplementation(
      () =>
        new Promise((resolve) => {
          acquired = resolve;
        })
    );
    const rows = collect(
      readonlyMysqlSnapshot(f.source, f.controller.signal, async function* () {
        yield 1;
      })
    );
    const rejected = expect(rows).rejects.toThrow('cancel capture');
    f.controller.abort(new Error('cancel capture'));
    await rejected;
    acquired(f.connection);
    await new Promise((resolve) => setImmediate(resolve));
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    expect(f.runner.startTransaction).not.toHaveBeenCalled();
  });
  it('times out an abandoned capture without waiting for source completion', async () => {
    const f = fixture();
    await expect(
      collect(
        readonlyMysqlSnapshot(
          f.source,
          f.controller.signal,
          async function* () {
            await new Promise(() => undefined);
            yield 1;
          },
          10
        )
      )
    ).rejects.toThrow('timed out');
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    expect(f.runner.release).toHaveBeenCalledTimes(1);
  });
  it('releases after setup and commit failures without fabricating completion', async () => {
    for (const operation of [
      'startTransaction',
      'commitTransaction',
    ] as const) {
      const f = fixture();
      f.runner[operation].mockRejectedValue(new Error('database offline'));
      await expect(
        collect(
          readonlyMysqlSnapshot(
            f.source,
            f.controller.signal,
            async function* () {
              yield 1;
            }
          )
        )
      ).rejects.toThrow('database offline');
      expect(f.connection.destroy).toHaveBeenCalledTimes(1);
      expect(f.runner.release).toHaveBeenCalledTimes(1);
    }
  });
});
