import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import {
  ACCOUNT_EXPORT_LIMITS,
  ACCOUNT_EXPORT_SOURCES,
  AccountExportCaptureSequence,
  AccountExportLimitExceeded,
  AccountExportSourceInvalid,
  isCanonicalIdentityId,
  parseAccountExportArtifact,
  type AccountExportCapture,
} from '@sdk/features/identity/core';
import type {
  AccountExportArchive,
  AccountExportSource,
} from '@sdk/features/identity/libs/management';

async function nextEntry<T>(
  iterator: AsyncIterator<T>,
  signal: AbortSignal
): Promise<IteratorResult<T>> {
  signal.throwIfAborted();
  let abort: () => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([iterator.next(), aborted]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

export class GzipAccountExportArchive implements AccountExportArchive {
  constructor(private readonly now = Date.now) {}

  async build(
    identityId: string,
    sources: readonly AccountExportSource[],
    write: (index: number, bytes: Uint8Array) => Promise<void>,
    signal: AbortSignal
  ) {
    signal.throwIfAborted();
    if (
      !isCanonicalIdentityId(identityId) ||
      sources.length !== ACCOUNT_EXPORT_SOURCES.length ||
      sources.some(
        (source, index) => source.name !== ACCOUNT_EXPORT_SOURCES[index]
      )
    )
      throw new AccountExportSourceInvalid(
        'Every canonical account export source is required'
      );
    const controller = new AbortController(),
      cancel = () => controller.abort(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    const captures: AccountExportCapture[] = [];
    let plainBytes = 0,
      records = 0,
      bytes = 0,
      chunks = 0;
    const hash = createHash('sha256');
    const persist = async (index: number, chunk: Uint8Array) => {
      try {
        await write(index, chunk);
      } catch (error) {
        controller.abort(error);
        throw error;
      }
    };
    const gzip = createGzip({ level: 6 });
    const compressionFailed = (error: Error) => controller.abort(error);
    gzip.on('error', compressionFailed);
    const encode = (value: unknown): Buffer => {
      const line = Buffer.from(JSON.stringify(value) + '\n', 'utf8');
      plainBytes += line.length;
      if (
        line.length > ACCOUNT_EXPORT_LIMITS.recordBytes ||
        plainBytes > ACCOUNT_EXPORT_LIMITS.uncompressedBytes
      )
        throw new AccountExportLimitExceeded(
          'Account export text exceeds configured bounds'
        );
      return line;
    };
    const capturedAt = this.now();
    async function* entries() {
      yield encode({
        type: 'manifest',
        format: 'wapps-account-export',
        version: 1,
        identityId,
        capturedAt,
        consistency: 'per-service canonical snapshots',
        sources: ACCOUNT_EXPORT_SOURCES,
      });
      for (const source of sources) {
        const sequence = new AccountExportCaptureSequence(source.name);
        const iterator = source
          .capture(identityId, controller.signal)
          [Symbol.asyncIterator]();
        let done = false;
        try {
          for (;;) {
            const item = await nextEntry(iterator, controller.signal);
            if (item.done) {
              done = true;
              break;
            }
            const entry = sequence.accept(item.value);
            if (
              entry.type === 'record' &&
              ++records > ACCOUNT_EXPORT_LIMITS.records
            )
              throw new AccountExportLimitExceeded(
                'Too many account export records'
              );
            yield encode(entry);
          }
          captures.push(sequence.finish());
        } finally {
          // A hung iterator must not keep compression or the worker alive after abort.
          if (!done) void iterator.return?.().catch(() => undefined);
        }
      }
      yield encode({ type: 'complete', captures });
    }
    try {
      await pipeline(
        Readable.from(entries(), { objectMode: false }),
        gzip,
        async (source) => {
          let buffer = Buffer.allocUnsafe(ACCOUNT_EXPORT_LIMITS.chunkBytes),
            offset = 0;
          for await (const piece of source) {
            controller.signal.throwIfAborted();
            const input = Buffer.isBuffer(piece) ? piece : Buffer.from(piece);
            bytes += input.length;
            if (bytes > ACCOUNT_EXPORT_LIMITS.archiveBytes)
              throw new AccountExportLimitExceeded(
                'Account export archive exceeds configured bounds'
              );
            hash.update(input);
            for (let consumed = 0; consumed < input.length; ) {
              const copied = input.copy(
                buffer,
                offset,
                consumed,
                Math.min(input.length, consumed + buffer.length - offset)
              );
              consumed += copied;
              offset += copied;
              if (offset === buffer.length) {
                await persist(chunks++, buffer);
                controller.signal.throwIfAborted();
                buffer = Buffer.allocUnsafe(ACCOUNT_EXPORT_LIMITS.chunkBytes);
                offset = 0;
              }
            }
          }
          if (offset)
            await persist(chunks++, Buffer.from(buffer.subarray(0, offset)));
        },
        { signal: controller.signal }
      );
      signal.throwIfAborted();
      return parseAccountExportArtifact({
        bytes,
        sha256: hash.digest('hex'),
        chunks,
        captures,
      });
    } catch (error) {
      controller.abort(error);
      if (signal.aborted) throw signal.reason;
      throw error;
    } finally {
      signal.removeEventListener('abort', cancel);
      gzip.removeListener('error', compressionFailed);
    }
  }
}
