import {
  ACCOUNT_EXPORT_LIMITS,
  AccountExportLimitExceeded,
  AccountExportSourceInvalid,
} from '@sdk/features/identity/core';
import { RemoteAccountExportSource } from './remote-account-export-source';

const credential = 's'.repeat(48);
const entries = [
  { type: 'begin', source: 'discussion', at: 1 },
  {
    type: 'record',
    source: 'discussion',
    collection: 'contributions',
    data: { content: 'My contribution' },
  },
  { type: 'end', source: 'discussion', at: 2, records: 1 },
];
const encode = (rows: unknown[]) =>
  rows.map((row) => JSON.stringify(row) + '\n').join('');
async function collect<T>(values: AsyncIterable<T>) {
  const result: T[] = [];
  for await (const value of values) result.push(value);
  return result;
}
function response(value = encode(entries), size = 13) {
  const bytes = Buffer.from(value);
  let offset = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === bytes.length) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.subarray(offset, offset + size));
        offset = Math.min(bytes.length, offset + size);
      },
    }),
    { headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } }
  );
}
function fixture() {
  const request = jest.fn().mockResolvedValue(response());
  return {
    request,
    source: new RemoteAccountExportSource(
      'discussion',
      'http://discussion:1338',
      credential,
      request
    ),
  };
}
describe('remote owning-service account export capture', () => {
  afterEach(() => jest.useRealTimers());
  it.each([1, 13, 4096])(
    'parses complete records across network chunks of %i bytes',
    async (size) => {
      const f = fixture();
      f.request.mockResolvedValue(response(encode(entries), size));
      expect(
        await collect(f.source.capture('Member', new AbortController().signal))
      ).toEqual(entries);
      expect(f.request).toHaveBeenCalledWith(
        'http://discussion:1338/api/internal/account-export',
        expect.objectContaining({
          method: 'POST',
          redirect: 'error',
          credentials: 'omit',
          body: '{"identityId":"Member"}',
          headers: {
            'content-type': 'application/json',
            accept: 'application/x-ndjson',
            'x-account-export-reader': credential,
          },
        })
      );
    }
  );
  it('preserves UTF-8 split inside a network chunk', async () => {
    const f = fixture();
    const rows = [
      entries[0],
      { ...entries[1], data: { text: '\u0142\ud83d\ude00' } },
      entries[2],
    ];
    f.request.mockResolvedValue(response(encode(rows), 1));
    expect(
      await collect(f.source.capture('Member', new AbortController().signal))
    ).toEqual(rows);
  });
  it.each([
    '',
    encode(entries.slice(0, 2)),
    encode(entries).trimEnd(),
    encode([...entries, entries[1]]),
    encode([entries[0], entries[1], { ...entries[2], records: 9 }]),
    encode([{ ...entries[0], source: 'editorial' }, ...entries.slice(1)]),
    encode(entries) + '\n',
    '{"incomplete":\n',
  ])(
    'rejects incomplete, foreign or malformed capture framing: %p',
    async (input) => {
      const f = fixture();
      f.request.mockResolvedValue(response(input));
      await expect(
        collect(f.source.capture('Member', new AbortController().signal))
      ).rejects.toBeInstanceOf(AccountExportSourceInvalid);
    }
  );
  it('bounds a record before JSON parsing', async () => {
    const f = fixture();
    f.request.mockResolvedValue(
      response('x'.repeat(ACCOUNT_EXPORT_LIMITS.recordBytes), 65536)
    );
    await expect(
      collect(f.source.capture('Member', new AbortController().signal))
    ).rejects.toBeInstanceOf(AccountExportLimitExceeded);
  });
  it.each([401, 403, 503])(
    'treats failed source HTTP %i as unavailable, without copying diagnostics',
    async (status) => {
      const f = fixture();
      f.request.mockResolvedValue(
        new Response('Private diagnostic', { status })
      );
      await expect(
        collect(f.source.capture('Member', new AbortController().signal))
      ).rejects.toThrow('owning service unavailable');
    }
  );
  it('rejects a success-shaped JSON error response', async () => {
    const f = fixture();
    f.request.mockResolvedValue(
      new Response('{"error":true}', {
        headers: { 'content-type': 'application/json' },
      })
    );
    await expect(
      collect(f.source.capture('Member', new AbortController().signal))
    ).rejects.toBeInstanceOf(AccountExportSourceInvalid);
  });
  it('releases the reader and request signal on early consumer return', async () => {
    const f = fixture(),
      cancel = jest.fn();
    f.request.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(Buffer.from(encode(entries)));
          },
          cancel,
        }),
        { headers: { 'content-type': 'application/x-ndjson' } }
      )
    );
    const iterator = f.source
      .capture('Member', new AbortController().signal)
      [Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.();
    expect(cancel).toHaveBeenCalled();
    expect(f.request.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('cancels a stalled request on deadline', async () => {
    jest.useFakeTimers();
    const f = fixture();
    f.request.mockImplementation(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) =>
          options.signal?.addEventListener(
            'abort',
            () => reject(options.signal?.reason),
            { once: true }
          )
        )
    );
    const checked = expect(
      collect(f.source.capture('Member', new AbortController().signal))
    ).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(300_000);
    await checked;
    expect(jest.getTimerCount()).toBe(0);
  });
  it('does not start a cancelled request and discards a late response', async () => {
    const f = fixture(),
      controller = new AbortController();
    controller.abort(new Error('Stop export'));
    await expect(
      collect(f.source.capture('Member', controller.signal))
    ).rejects.toThrow('Stop export');
    expect(f.request).not.toHaveBeenCalled();
    const late = new AbortController(),
      cancel = jest.fn();
    f.request.mockImplementation(async () => {
      late.abort(new Error('Late export'));
      return new Response(new ReadableStream({ cancel }), {
        headers: { 'content-type': 'application/x-ndjson' },
      });
    });
    await expect(
      collect(f.source.capture('Member', late.signal))
    ).rejects.toThrow('Late export');
    expect(cancel).toHaveBeenCalled();
  });
  it.each([
    'http://user:secret@discussion',
    'http://discussion/private',
    'http://discussion?tenant=other',
    'file:///private',
    'http://discussion#fragment',
  ])('rejects unsafe source configuration: %s', (origin) => {
    expect(
      () => new RemoteAccountExportSource('discussion', origin, credential)
    ).toThrow();
  });
});
