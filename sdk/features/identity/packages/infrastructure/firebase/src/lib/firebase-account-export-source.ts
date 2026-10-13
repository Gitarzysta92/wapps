import * as admin from 'firebase-admin';
import {
  AccountExportCaptureSequence,
  AccountExportSourceInvalid,
  CanonicalIdentityAccessDenied,
  isCanonicalIdentityId,
  type AccountExportEntry,
} from '@sdk/features/identity/core';
import type { AccountExportSource } from '@sdk/features/identity/libs/management';
import { firebaseErrorCode } from './firebase-errors';

function text(value: unknown, maximum = 4096): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > maximum)
    throw new AccountExportSourceInvalid('Invalid credential profile field');
  return value;
}
function time(value: unknown): string | null {
  const input = text(value, 100);
  if (input === null) return null;
  const at = Date.parse(input);
  if (!Number.isFinite(at) || at < 0)
    throw new AccountExportSourceInvalid('Invalid credential timestamp');
  return new Date(at).toISOString();
}

export class FirebaseAccountExportSource implements AccountExportSource {
  readonly name = 'credentials';
  constructor(
    private readonly auth: () => Pick<admin.auth.Auth, 'getUser'> = () =>
      admin.auth(),
    private readonly now = Date.now,
    private readonly timeoutMs = 10_000
  ) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000)
      throw new Error('Invalid credential capture timeout');
  }

  async *capture(
    identityId: string,
    signal: AbortSignal
  ): AsyncIterable<AccountExportEntry> {
    signal.throwIfAborted();
    if (!isCanonicalIdentityId(identityId))
      throw new CanonicalIdentityAccessDenied('Authentication required');
    const sequence = new AccountExportCaptureSequence(this.name),
      startedAt = this.now();
    let timer: ReturnType<typeof setTimeout> | undefined,
      abort: () => void = () => undefined;
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(
        () => reject(new Error('Credential account export timed out')),
        this.timeoutMs
      );
    });
    let user: admin.auth.UserRecord;
    try {
      user = await Promise.race([this.auth().getUser(identityId), interrupted]);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (firebaseErrorCode(error) === 'auth/user-not-found')
        throw new CanonicalIdentityAccessDenied(
          'Credential account is unavailable'
        );
      throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
    signal.throwIfAborted();
    if (user.uid !== identityId || user.disabled)
      throw new CanonicalIdentityAccessDenied(
        'Credential account is unavailable'
      );
    if (
      typeof user.disabled !== 'boolean' ||
      typeof user.emailVerified !== 'boolean' ||
      !user.metadata ||
      !Array.isArray(user.providerData) ||
      user.providerData.length > 32
    )
      throw new AccountExportSourceInvalid(
        'Invalid credential account response'
      );
    let records = 0;
    const entry = (collection: string, data: unknown) => {
      signal.throwIfAborted();
      const result = sequence.accept({
        type: 'record',
        source: this.name,
        collection,
        data,
      });
      records++;
      return result;
    };
    yield sequence.accept({ type: 'begin', source: this.name, at: startedAt });
    // UserRecord serialization includes credential secrets and internal claims; keep an explicit allowlist.
    yield entry('credential-user', {
      uid: user.uid,
      email: text(user.email, 320),
      emailVerified: user.emailVerified,
      displayName: text(user.displayName),
      phoneNumber: text(user.phoneNumber, 100),
      photoURL: text(user.photoURL),
      createdAt: time(user.metadata.creationTime),
      lastSignInAt: time(user.metadata.lastSignInTime),
      lastRefreshAt: time(user.metadata.lastRefreshTime),
      tokensRevokedBefore: time(user.tokensValidAfterTime),
    });
    const providers = new Set<string>();
    for (const provider of user.providerData) {
      const providerId = text(provider.providerId, 128),
        uid = text(provider.uid, 512);
      if (!providerId || !uid || providers.has(providerId))
        throw new AccountExportSourceInvalid(
          'Invalid linked credential provider'
        );
      providers.add(providerId);
      yield entry('linked-provider', {
        providerId,
        uid,
        email: text(provider.email, 320),
        displayName: text(provider.displayName),
        phoneNumber: text(provider.phoneNumber, 100),
        photoURL: text(provider.photoURL),
      });
    }
    const factors = user.multiFactor?.enrolledFactors ?? [];
    if (!Array.isArray(factors) || factors.length > 16)
      throw new AccountExportSourceInvalid('Invalid multi-factor metadata');
    for (const factor of factors) {
      const id = text(factor.uid, 128),
        kind = text(factor.factorId, 128);
      if (!id || !kind)
        throw new AccountExportSourceInvalid('Invalid multi-factor metadata');
      yield entry('multi-factor-enrollment', {
        id,
        kind,
        displayName: text(factor.displayName),
        enrolledAt: time(factor.enrollmentTime),
        phoneNumber:
          'phoneNumber' in factor ? text(factor.phoneNumber, 100) : null,
      });
    }
    signal.throwIfAborted();
    yield sequence.accept({
      type: 'end',
      source: this.name,
      at: this.now(),
      records,
    });
  }
}
