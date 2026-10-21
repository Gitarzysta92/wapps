import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  AccountExportCaptureSequence,
  credentialSubject,
  type AccountExportEntry,
  type CredentialIdentityBindings,
} from '@sdk/features/identity/core';
import {
  credentialObject,
  credentialRequest,
  credentialText,
  CredentialRegistrationRejected,
  IdentityAuthenticationUnavailable,
  EmailVerificationRejected,
  EmailVerificationThrottled,
  PasswordResetRejected,
  type CredentialOperation,
  type AuthSessionDto,
  type VerifiedCredentialPrincipal,
  type CredentialEmailVerification,
  type CredentialPasswordReset,
} from '@sdk/features/identity/libs/authentication';
import {
  CredentialInputError,
  CredentialUnavailable,
  type IUserAdminPort,
  type AccountExportSource,
  type PasswordRecovery,
} from '@sdk/features/identity/libs/management';

class CredentialRpcRejected extends Error {
  constructor(readonly status: number) {
    super('Credential request rejected');
  }
}

/** Identity is the consumer: resolve its IDs before crossing the credential boundary. */
export class RemoteCredentials implements IUserAdminPort, AccountExportSource {
  readonly name = 'credentials';
  constructor(
    private readonly origin: string,
    readonly issuer: string,
    private readonly secret: string,
    private readonly bindings: CredentialIdentityBindings,
    private readonly fetcher: typeof fetch = fetch
  ) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(secret)
    )
      throw new Error('Invalid authentication service configuration');
    credentialSubject({ issuer, subject: 'configuration' });
  }

  signInWithPassword(email: string, password: string) {
    return this.authentication(async () =>
      this.session(await this.request('password-session', { email, password }))
    );
  }
  registerOrAuthenticate(email: string, password: string, key?: string) {
    return this.authentication(async () =>
      this.session(
        await this.request('registration', { email, password, key }),
        true
      )
    );
  }
  refresh(refreshToken: string) {
    return this.authentication(async () =>
      this.session(await this.request('refresh', { refreshToken }))
    );
  }
  verifyIdToken(
    token: string
  ): Promise<Result<VerifiedCredentialPrincipal, Error>> {
    return this.authentication(async () => {
      const value = credentialObject(
        await this.request('verify-token', { token }),
        ['subject', 'email', 'authTime', 'claims']
      );
      const uid = credentialSubject({
        issuer: this.issuer,
        subject: credentialText(value['subject'], 128),
      }).subject;
      const email =
        value['email'] === undefined
          ? undefined
          : credentialText(value['email'], 254);
      const authTime = value['authTime'];
      if (
        authTime !== undefined &&
        (typeof authTime !== 'number' ||
          !Number.isSafeInteger(authTime) ||
          authTime < 0)
      )
        throw new Error('Invalid credential authentication time');
      const claims = value['claims'];
      if (
        claims !== undefined &&
        (!claims ||
          typeof claims !== 'object' ||
          Array.isArray(claims) ||
          JSON.stringify(claims).length > 8192)
      )
        throw new Error('Invalid credential claims');
      return {
        uid,
        ...(email === undefined ? {} : { email }),
        ...(authTime === undefined ? {} : { authTime: authTime as number }),
        ...(claims === undefined ? {} : { claims }),
      };
    });
  }

  revokeRefreshTokens(uid: string) {
    return this.admin(() => this.allSubjects(uid, 'revoke'));
  }
  deleteUser(uid: string) {
    return this.admin(() => this.allSubjects(uid, 'delete'));
  }
  updateUser(uid: string, patch: Parameters<IUserAdminPort['updateUser']>[1]) {
    return this.admin(async () => {
      this.confirm(
        await this.request('update', {
          subject: await this.singleSubject(uid),
          patch,
        })
      );
      return true;
    });
  }
  generatePasswordResetLink(uid: string, email: string) {
    return this.link('password-reset-link', uid, email);
  }
  generateEmailVerificationLink(uid: string, email: string) {
    return this.link('email-verification-link', uid, email);
  }

  readonly recovery: PasswordRecovery = {
    send: async (email) => {
      this.confirm(await this.request('password-recovery', { email }));
    },
  };
  readonly reset: CredentialPasswordReset = {
    verify: (code) =>
      this.action('password-reset-verify', { code }, PasswordResetRejected),
    complete: (code, password) =>
      this.action(
        'password-reset-complete',
        { code, password },
        PasswordResetRejected
      ),
  };
  readonly email: CredentialEmailVerification = {
    status: async ({ uid, token }) => {
      const value = credentialObject(
        await this.request('email-status', {
          subject: await this.singleSubject(uid),
          token,
        }),
        ['email', 'verified']
      );
      if (typeof value['verified'] !== 'boolean')
        throw new Error('Invalid email status');
      return {
        email:
          value['email'] === null ? null : credentialText(value['email'], 254),
        verified: value['verified'],
      };
    },
    request: async ({ uid, token }) => {
      try {
        const value = credentialObject(
          await this.request('email-request', {
            subject: await this.singleSubject(uid),
            token,
          }),
          ['outcome']
        );
        if (
          value['outcome'] !== 'requested' &&
          value['outcome'] !== 'already-verified'
        )
          throw new Error('Invalid email request receipt');
        return value['outcome'];
      } catch (error) {
        if (error instanceof CredentialRpcRejected && error.status === 429)
          throw new EmailVerificationThrottled('Email verification throttled');
        throw error;
      }
    },
    verify: (code) =>
      this.action('email-verify', { code }, EmailVerificationRejected),
    complete: (code) =>
      this.action('email-complete', { code }, EmailVerificationRejected),
  };

  async *capture(
    identityId: string,
    signal: AbortSignal
  ): AsyncIterable<AccountExportEntry> {
    const subjects = await this.subjects(identityId);
    const sequence = new AccountExportCaptureSequence(this.name);
    let records = 0;
    yield sequence.accept({ type: 'begin', source: this.name, at: Date.now() });
    for (const subject of subjects) {
      const value = credentialObject(
        await this.request('export', { subject }, signal),
        ['entries']
      );
      if (!Array.isArray(value['entries']) || value['entries'].length > 64)
        throw new Error('Invalid credential export');
      const capture = new AccountExportCaptureSequence(this.name);
      const entries = value['entries'].map((entry) => capture.accept(entry));
      capture.finish();
      for (const entry of entries)
        if (entry.type === 'record') {
          signal.throwIfAborted();
          yield sequence.accept(entry);
          records++;
        }
    }
    yield sequence.accept({
      type: 'end',
      source: this.name,
      at: Date.now(),
      records,
    });
  }

  private session(
    input: unknown,
    registration = false
  ): AuthSessionDto & { enrollmentEligible?: boolean } {
    const value = credentialObject(input, [
      'subject',
      'token',
      'refreshToken',
      'expiresIn',
      ...(registration ? ['enrollmentEligible'] : []),
    ]);
    const uid = credentialSubject({
      issuer: this.issuer,
      subject: credentialText(value['subject'], 128),
    }).subject;
    const token = credentialText(value['token'], 16384),
      refreshToken = credentialText(value['refreshToken'], 16384),
      expiresIn = credentialText(value['expiresIn'], 10);
    if (
      /\s/.test(token + refreshToken) ||
      !/^[1-9][0-9]*$/.test(expiresIn) ||
      Number(expiresIn) > 86400 ||
      (registration && typeof value['enrollmentEligible'] !== 'boolean')
    )
      throw new Error('Invalid credential session');
    return {
      uid,
      token,
      refreshToken,
      expiresIn,
      ...(registration
        ? { enrollmentEligible: value['enrollmentEligible'] === true }
        : {}),
    };
  }
  private async subjects(uid: string): Promise<string[]> {
    const bindings = await this.bindings.credentialSubjects(uid);
    if (
      !bindings.length ||
      bindings.length > 64 ||
      bindings.some(
        (binding) => credentialSubject(binding).issuer !== this.issuer
      )
    )
      throw new Error('All bound authentication issuers must be configured');
    return bindings.map((binding) => binding.subject);
  }
  private async singleSubject(uid: string): Promise<string> {
    const subjects = await this.subjects(uid);
    if (subjects.length !== 1)
      throw new Error('Credential selection is ambiguous');
    return subjects[0];
  }
  private async allSubjects(
    uid: string,
    operation: 'delete' | 'revoke'
  ): Promise<boolean> {
    for (const subject of await this.subjects(uid))
      this.confirm(await this.request(operation, { subject }));
    return true;
  }
  private confirm(input: unknown): void {
    const value = credentialObject(input, ['confirmed']);
    if (value['confirmed'] !== true)
      throw new Error('Credential operation unconfirmed');
  }
  private async link(
    operation: 'password-reset-link' | 'email-verification-link',
    uid: string,
    email: string
  ) {
    return this.admin(async () => {
      const value = credentialObject(
        await this.request(operation, {
          subject: await this.singleSubject(uid),
          email,
        }),
        ['link']
      );
      const link = credentialText(value['link'], 8192),
        url = new URL(link);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error('Invalid credential action link');
      return link;
    });
  }
  private async action(
    operation: CredentialOperation,
    body: unknown,
    Rejected: new (message: string) => Error
  ): Promise<void> {
    try {
      this.confirm(await this.request(operation, body));
    } catch (error) {
      if (
        error instanceof CredentialRpcRejected &&
        [400, 401].includes(error.status)
      )
        throw new Rejected('Credential action rejected');
      throw error;
    }
  }
  private async authentication<T>(
    run: () => Promise<T>
  ): Promise<Result<T, Error>> {
    try {
      return ok(await run());
    } catch (error) {
      return err(
        error instanceof CredentialRpcRejected &&
          [400, 401].includes(error.status)
          ? new CredentialRegistrationRejected('Invalid credentials')
          : new IdentityAuthenticationUnavailable(
              'Authentication service unavailable'
            )
      );
    }
  }
  private async admin<T>(run: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      return ok(await run());
    } catch (error) {
      return err(
        error instanceof CredentialRpcRejected && error.status === 400
          ? new CredentialInputError('Credential update rejected')
          : new CredentialUnavailable('Authentication service unavailable')
      );
    }
  }

  private async request(
    operation: CredentialOperation,
    input: unknown,
    signal?: AbortSignal
  ): Promise<unknown> {
    const request = credentialRequest(operation, input);
    const body = JSON.stringify(request);
    if (Buffer.byteLength(body) > 32 * 1024)
      throw new Error('Credential request too large');
    const timeout = AbortSignal.timeout(10000);
    const response = await this.fetcher(
      new URL(`/credentials/${operation}`, this.origin),
      {
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-credential-service': this.secret,
        },
        body,
      }
    );
    if (![200, 400, 401, 429].includes(response.status)) {
      await response.body?.cancel();
      throw new Error('Authentication dependency unavailable');
    }
    if (
      !/^application\/json(?:\s*;|$)/i.test(
        response.headers.get('content-type') ?? ''
      ) ||
      !response.body
    ) {
      await response.body?.cancel();
      throw new Error('Invalid authentication response');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 256 * 1024)
          throw new Error('Authentication response too large');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    const decoded: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (response.status !== 200) {
      const failure = credentialObject(decoded, ['issuer', 'error']);
      if (
        failure['issuer'] === this.issuer &&
        (([400, 401].includes(response.status) &&
          failure['error'] === 'rejected') ||
          (response.status === 429 && failure['error'] === 'throttled'))
      )
        throw new CredentialRpcRejected(response.status);
      throw new Error('Authentication service contract rejected');
    }
    const result = credentialObject(decoded, ['issuer', 'subject', 'value']);
    if (
      result['issuer'] !== this.issuer ||
      result['subject'] !== request['subject'] ||
      result['value'] === undefined
    )
      throw new Error('Authentication issuer or subject mismatch');
    return result['value'];
  }
}
