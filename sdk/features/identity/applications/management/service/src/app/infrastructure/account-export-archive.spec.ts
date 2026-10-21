import { createHash, randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import {
  ACCOUNT_EXPORT_LIMITS,
  AccountExportLimitExceeded,
  AccountExportSourceInvalid,
  type AccountExportEntry,
} from '@sdk/features/identity/core';
import { ACCOUNT_EXPORT_SOURCES } from '@wapps/account';
import type { AccountExportSource } from '@sdk/features/identity/libs/management';
import { GzipAccountExportArchive } from './account-export-archive';

function sources(data = 'Member'): AccountExportSource[] {
  return ACCOUNT_EXPORT_SOURCES.map((name) => ({
    name,
    async *capture(
      _identityId: string,
      signal: AbortSignal
    ): AsyncIterable<AccountExportEntry> {
      signal.throwIfAborted();
      yield { type: 'begin', source: name, at: 100 };
      yield {
        type: 'record',
        source: name,
        collection: 'fixture',
        data: name === 'account' ? data : { source: name },
      };
      yield { type: 'end', source: name, at: 200, records: 1 };
    },
  }));
}
function fixture() {
  const chunks: Buffer[] = [],
    controller = new AbortController();
  const write = jest.fn(async (index: number, bytes: Uint8Array) => {
    expect(index).toBe(chunks.length);
    chunks.push(Buffer.from(bytes));
  });
  return {
    chunks,
    controller,
    write,
    archive: new GzipAccountExportArchive(() => 100),
  };
}

describe('bounded complete gzip account archives', () => {
  it('round trips all source records with completion receipts and exact digest', async () => {
    const f = fixture(),
      data = randomBytes(700_000).toString('base64');
    const artifact = await f.archive.build(
      'Member',
      sources(data),
      f.write,
      f.controller.signal
    );
    const zipped = Buffer.concat(f.chunks);
    const lines = gunzipSync(zipped)
      .toString('utf8')
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(artifact.bytes).toBe(zipped.length);
    expect(artifact.sha256).toBe(
      createHash('sha256').update(zipped).digest('hex')
    );
    expect(artifact.chunks).toBe(f.chunks.length);
    expect(f.chunks.length).toBeGreaterThan(2);
    expect(
      f.chunks
        .slice(0, -1)
        .every((chunk) => chunk.length === ACCOUNT_EXPORT_LIMITS.chunkBytes)
    ).toBe(true);
    expect(lines[0]).toMatchObject({
      type: 'manifest',
      version: 1,
      identityId: 'Member',
      sources: ACCOUNT_EXPORT_SOURCES,
    });
    expect(lines[2]).toEqual({
      type: 'record',
      source: 'account',
      collection: 'fixture',
      data,
    });
    expect(lines[lines.length - 1]).toEqual({
      type: 'complete',
      captures: artifact.captures,
    });
    expect(artifact.captures.map((capture) => capture.records)).toEqual([
      1, 1, 1, 1,
    ]);
  });
  it.each([
    'missing-source',
    'wrong-source',
    'missing-end',
    'count-mismatch',
    'trailing-record',
  ])('never produces a ready artifact for %s', async (kind) => {
    const f = fixture(),
      inputs = sources();
    if (kind === 'missing-source') inputs.pop();
    else
      inputs[0] = {
        name: 'account',
        async *capture(): AsyncIterable<AccountExportEntry> {
          yield {
            type: 'begin',
            source: kind === 'wrong-source' ? 'editorial' : 'account',
            at: 100,
          };
          if (kind !== 'missing-end')
            yield {
              type: 'end',
              source: 'account',
              at: 200,
              records: kind === 'count-mismatch' ? 1 : 0,
            };
          if (kind === 'trailing-record')
            yield {
              type: 'record',
              source: 'account',
              collection: 'fixture',
              data: 'late',
            };
        },
      };
    await expect(
      f.archive.build('Member', inputs, f.write, f.controller.signal)
    ).rejects.toBeInstanceOf(AccountExportSourceInvalid);
  });
  it('checks UTF-8 byte bounds before compressing, including highly compressible text', async () => {
    const f = fixture();
    await expect(
      f.archive.build(
        'Member',
        sources('\u00e9'.repeat(600_000)),
        f.write,
        f.controller.signal
      )
    ).rejects.toBeInstanceOf(AccountExportLimitExceeded);
  });
  it('cancels a source that never yields and returns without waiting for it', async () => {
    const f = fixture(),
      inputs = sources();
    let observed: AbortSignal | undefined;
    inputs[0] = {
      name: 'account',
      capture(_uid, signal) {
        observed = signal;
        return {
          [Symbol.asyncIterator]: () => ({
            next: () =>
              new Promise<IteratorResult<AccountExportEntry>>(() => undefined),
          }),
        };
      },
    };
    const result = f.archive.build(
      'Member',
      inputs,
      f.write,
      f.controller.signal
    );
    const expected = expect(result).rejects.toThrow('cancelled');
    await new Promise((resolve) => setImmediate(resolve));
    f.controller.abort(new Error('cancelled'));
    await expected;
    expect(observed?.aborted).toBe(true);
    expect(f.write).not.toHaveBeenCalled();
  });
  it('aborts the source if chunk storage fails while its next entry is stuck', async () => {
    const f = fixture(),
      inputs = sources();
    let observed: AbortSignal | undefined;
    inputs[0] = {
      name: 'account',
      async *capture(_uid, signal): AsyncIterable<AccountExportEntry> {
        observed = signal;
        yield { type: 'begin', source: 'account', at: 100 };
        yield {
          type: 'record',
          source: 'account',
          collection: 'binary',
          data: randomBytes(700_000).toString('base64'),
        };
        await new Promise(() => undefined);
      },
    };
    f.write.mockRejectedValue(new Error('storage offline'));
    await expect(
      f.archive.build('Member', inputs, f.write, f.controller.signal)
    ).rejects.toThrow();
    expect(observed?.aborted).toBe(true);
  });
  it('propagates a source outage and cancels capture resources', async () => {
    const f = fixture(),
      inputs = sources();
    let observed: AbortSignal | undefined;
    inputs[0] = {
      name: 'account',
      async *capture(_uid, signal): AsyncIterable<AccountExportEntry> {
        observed = signal;
        yield { type: 'begin', source: 'account', at: 100 };
        throw new Error('source unavailable');
      },
    };
    await expect(
      f.archive.build('Member', inputs, f.write, f.controller.signal)
    ).rejects.toThrow('source unavailable');
    expect(observed?.aborted).toBe(true);
  });
});
