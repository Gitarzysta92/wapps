import {
  ACCOUNT_EXPORT_LIMITS,
  AccountExportCaptureSequence,
  AccountExportLimitExceeded,
  AccountExportSourceInvalid,
  isCanonicalIdentityId,
  type AccountExportEntry,
} from '@sdk/features/identity/core';
import type { AccountExportSource } from '@sdk/features/identity/libs/management';

export class RemoteAccountExportSource implements AccountExportSource {
  private readonly url: string;
  constructor(
    readonly name: 'editorial' | 'discussion',
    origin: string,
    private readonly credential: string,
    private readonly request: typeof fetch = fetch
  ) {
    const parsed = new URL(origin);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== '/' ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(credential) ||
      !['editorial', 'discussion'].includes(name)
    )
      throw new Error('Invalid remote account export source configuration');
    this.url = `${parsed.origin}/api/internal/account-export`;
  }

  async *capture(
    identityId: string,
    signal: AbortSignal
  ): AsyncIterable<AccountExportEntry> {
    signal.throwIfAborted();
    if (!isCanonicalIdentityId(identityId))
      throw new AccountExportSourceInvalid('Invalid export owner');
    const controller = new AbortController();
    const cancel = () => controller.abort(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    const timer = setTimeout(
      () =>
        controller.abort(new Error('Account export source request timed out')),
      300_000
    );
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let response: Response | undefined;
    try {
      response = await this.request(this.url, {
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          accept: 'application/x-ndjson',
          'x-account-export-reader': this.credential,
        },
        body: JSON.stringify({ identityId }),
      });
      controller.signal.throwIfAborted();
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error('Account export owning service unavailable');
      }
      if (
        response.headers
          .get('content-type')
          ?.split(';')[0]
          .trim()
          .toLowerCase() !== 'application/x-ndjson' ||
        !response.body
      ) {
        await response.body?.cancel();
        throw new AccountExportSourceInvalid(
          'Invalid account export source response'
        );
      }
      reader = response.body.getReader();
      const sequence = new AccountExportCaptureSequence(this.name);
      // One fixed record buffer bounds retained memory independently of network chunk boundaries.
      const line = new Uint8Array(ACCOUNT_EXPORT_LIMITS.recordBytes);
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let used = 0,
        bytes = 0;
      for (;;) {
        controller.signal.throwIfAborted();
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        if (bytes > ACCOUNT_EXPORT_LIMITS.uncompressedBytes)
          throw new AccountExportLimitExceeded(
            'Account export source exceeds stream bounds'
          );
        let offset = 0;
        while (offset < part.value.length) {
          const newline = part.value.indexOf(10, offset);
          const end = newline < 0 ? part.value.length : newline;
          const length = end - offset;
          if (used + length >= line.length)
            throw new AccountExportLimitExceeded(
              'Account export source record exceeds stream bounds'
            );
          line.set(part.value.subarray(offset, end), used);
          used += length;
          offset = end + 1;
          if (newline < 0) continue;
          let value: unknown;
          try {
            value = JSON.parse(decoder.decode(line.subarray(0, used)));
          } catch {
            throw new AccountExportSourceInvalid(
              'Invalid account export source JSON'
            );
          }
          used = 0;
          controller.signal.throwIfAborted();
          yield sequence.accept(value);
        }
      }
      controller.signal.throwIfAborted();
      if (used !== 0)
        throw new AccountExportSourceInvalid(
          'Truncated account export source record'
        );
      sequence.finish();
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      controller.abort();
      try {
        if (reader) await reader.cancel();
        else await response?.body?.cancel();
      } catch {
        /* Cancellation may close the HTTP reader first. */
      }
      reader?.releaseLock();
    }
  }
}
