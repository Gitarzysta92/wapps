import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  CredentialRegistrationRejected,
  IdentityAuthenticationUnavailable,
  type AuthSessionDto,
  type CredentialSessionRevoker,
  type CredentialTokenVerifier,
  type IAuthenticationRefreshToken,
  type PasswordSignIn,
  type RegistrationCredentials,
  type VerifiedCredentialPrincipal,
} from '@sdk/features/identity/libs/authentication';
import {
  CredentialInputError,
  CredentialUnavailable,
  type AccountExportSource,
  type IUserAdminPort,
  type UserUpdateDto,
} from '@sdk/features/identity/libs/management';
import {
  AccountExportCaptureSequence,
  CanonicalIdentityAccessDenied,
  type AccountExportEntry,
} from '@sdk/features/identity/core';

interface LocalUser {
  uid: string;
  email: string | null;
  password_salt: string | null;
  password_hash: string | null;
  disabled: number;
  deleted: number;
  claims_json: string | Record<string, unknown>;
  created_at: number | string;
  last_sign_in_at: number | string | null;
}
interface LocalSession {
  uid: string;
  access_hash: string;
  refresh_hash: string;
  auth_time: number | string;
  access_expires_at: number | string;
  refresh_expires_at: number | string;
}

const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const rejected = () =>
  new CredentialRegistrationRejected('Credentials were rejected');

function emailAddress(input: string): string {
  if (
    typeof input !== 'string' ||
    input.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
  )
    throw rejected();
  return input.toLowerCase();
}
function passwordInput(input: string): void {
  if (typeof input !== 'string' || input.length < 6 || input.length > 128)
    throw rejected();
}
function authorizationClaims(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid local claims');
  const claims = value as Record<string, unknown>;
  if (Object.keys(claims).some((key) => !['roles', 'tenantId'].includes(key)))
    throw new Error('Unsupported local claims');
  if (
    claims['roles'] !== undefined &&
    (!Array.isArray(claims['roles']) ||
      claims['roles'].length > 64 ||
      claims['roles'].some(
        (role) =>
          typeof role !== 'string' ||
          !role ||
          role.length > 128 ||
          role.trim() !== role
      ))
  )
    throw new Error('Invalid local roles');
  if (
    claims['tenantId'] !== undefined &&
    (typeof claims['tenantId'] !== 'string' ||
      !claims['tenantId'] ||
      claims['tenantId'].length > 128 ||
      claims['tenantId'].trim() !== claims['tenantId'])
  )
    throw new Error('Invalid local tenant');
  return claims;
}
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, value) =>
      error ? reject(error) : resolve(value)
    );
  });
}

export async function localPasswordMatches(
  password: string,
  salt: string,
  hash: string
): Promise<boolean> {
  passwordInput(password);
  if (!/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(hash))
    throw new Error('Invalid stored credential');
  return timingSafeEqual(
    await derive(password, salt),
    Buffer.from(hash, 'hex')
  );
}

/** Explicit development adapter. It owns credentials, never canonical account permissions. */
export class MysqlLocalCredentials
  implements
    PasswordSignIn,
    RegistrationCredentials,
    IAuthenticationRefreshToken,
    CredentialTokenVerifier,
    CredentialSessionRevoker,
    IUserAdminPort,
    AccountExportSource
{
  readonly name = 'credentials';

  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now,
    private readonly accessSeconds = 3600,
    private readonly refreshSeconds = 604800
  ) {
    if (
      ![accessSeconds, refreshSeconds].every(
        (value) => Number.isSafeInteger(value) && value > 0
      ) ||
      accessSeconds > 86400 ||
      refreshSeconds > 2592000 ||
      refreshSeconds < accessSeconds
    )
      throw new Error('Invalid local session lifetime');
  }

  signInWithPassword(
    email: string,
    password: string
  ): Promise<Result<AuthSessionDto, Error>> {
    return this.passwordSession(email, password, false);
  }

  registerOrAuthenticate(
    email: string,
    password: string,
    key?: string
  ): Promise<Result<AuthSessionDto & { enrollmentEligible?: boolean }, Error>> {
    return this.passwordSession(email, password, true, key);
  }

  private passwordSession(
    email: string,
    password: string,
    create: boolean,
    key?: string
  ): Promise<Result<AuthSessionDto & { enrollmentEligible?: boolean }, Error>> {
    return this.authentication(async () => {
      if (key !== undefined && !/^[\x21-\x7e]{1,128}$/.test(key))
        throw rejected();
      const address = emailAddress(email);
      passwordInput(password);
      return this.transaction(async (runner) => {
        let [user]: LocalUser[] = await runner.query(
          'SELECT * FROM local_credential_users WHERE email = ? FOR UPDATE',
          [address]
        );
        if (!user && create) {
          const salt = randomBytes(16).toString('hex');
          user = {
            uid: `local:${randomUUID()}`,
            email: address,
            password_salt: salt,
            password_hash: (await derive(password, salt)).toString('hex'),
            disabled: 0,
            deleted: 0,
            claims_json: '{}',
            created_at: this.now(),
            last_sign_in_at: null,
          };
          await runner.query(
            `INSERT INTO local_credential_users
            (uid, email, password_salt, password_hash, claims_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              user.uid,
              user.email,
              user.password_salt,
              user.password_hash,
              user.claims_json,
              user.created_at,
            ]
          );
          if (key !== undefined)
            await runner.query(
              'INSERT INTO local_credential_enrollments (uid, request_hash) VALUES (?, ?)',
              [user.uid, digest(key)]
            );
        } else {
          // Perform the same derivation for unknown email addresses, without inventing an account.
          const matches = await localPasswordMatches(
            password,
            user?.password_salt ?? '0'.repeat(32),
            user?.password_hash ?? '0'.repeat(128)
          );
          if (!user || !matches) throw rejected();
        }
        this.available(user);
        await runner.query(
          'UPDATE local_credential_users SET last_sign_in_at = ? WHERE uid = ?',
          [this.now(), user.uid]
        );
        const session = await this.issue(runner, user.uid, this.now());
        if (create && key !== undefined) {
          const receipts: { request_hash: string }[] = await runner.query(
            'SELECT request_hash FROM local_credential_enrollments WHERE uid = ?',
            [user.uid]
          );
          return {
            ...session,
            enrollmentEligible: receipts[0]?.request_hash === digest(key),
          };
        }
        return session;
      });
    });
  }

  refresh(token: string): Promise<Result<AuthSessionDto, Error>> {
    return this.authentication(async () => {
      this.token(token);
      return this.transaction(async (runner) => {
        const [candidate]: LocalSession[] = await runner.query(
          'SELECT * FROM local_credential_sessions WHERE refresh_hash = ?',
          [digest(token)]
        );
        if (!candidate) throw rejected();
        // Lock users before sessions in every mutating path, including sign-out and deletion.
        const user = await this.user(runner, candidate.uid);
        this.available(user);
        const [session]: LocalSession[] = await runner.query(
          'SELECT * FROM local_credential_sessions WHERE refresh_hash = ? FOR UPDATE',
          [digest(token)]
        );
        if (!session || Number(session.refresh_expires_at) <= this.now())
          throw rejected();
        await runner.query(
          'DELETE FROM local_credential_sessions WHERE refresh_hash = ?',
          [session.refresh_hash]
        );
        return this.issue(
          runner,
          user.uid,
          Number(session.auth_time),
          Number(session.refresh_expires_at)
        );
      });
    });
  }

  verifyIdToken(
    token: string
  ): Promise<Result<VerifiedCredentialPrincipal, Error>> {
    return this.authentication(async () => {
      this.token(token);
      const [session]: (LocalUser & LocalSession)[] = await this.source.query(
        `SELECT u.*, s.auth_time, s.access_expires_at
        FROM local_credential_sessions s JOIN local_credential_users u ON u.uid = s.uid WHERE s.access_hash = ?`,
        [digest(token)]
      );
      if (!session || Number(session.access_expires_at) <= this.now())
        throw rejected();
      this.available(session);
      const claims: unknown =
        typeof session.claims_json === 'string'
          ? JSON.parse(session.claims_json)
          : session.claims_json;
      return {
        uid: session.uid,
        email: session.email ?? undefined,
        authTime: Math.floor(Number(session.auth_time) / 1000),
        claims: authorizationClaims(claims),
      };
    });
  }

  revokeRefreshTokens(uid: string): Promise<Result<boolean, Error>> {
    return this.admin(async (runner) => {
      this.available(await this.user(runner, uid));
      await runner.query(
        'DELETE FROM local_credential_sessions WHERE uid = ?',
        [uid]
      );
    });
  }

  updateUser(
    uid: string,
    patch: UserUpdateDto
  ): Promise<Result<boolean, Error>> {
    return this.admin(async (runner) => {
      const user = await this.user(runner, uid);
      if (!user || user.deleted) throw rejected();
      if (patch.providersToUnlink !== undefined)
        throw new CredentialInputError(
          'Local authentication does not support linked providers'
        );
      const email =
        patch.email === undefined ? user.email : emailAddress(patch.email);
      let salt = user.password_salt,
        hash = user.password_hash;
      if (patch.password !== undefined) {
        passwordInput(patch.password);
        salt = randomBytes(16).toString('hex');
        hash = (await derive(patch.password, salt)).toString('hex');
      }
      await runner.query(
        'UPDATE local_credential_users SET email = ?, password_salt = ?, password_hash = ?, disabled = ? WHERE uid = ?',
        [email, salt, hash, patch.disabled ?? Boolean(user.disabled), uid]
      );
      await runner.query(
        'DELETE FROM local_credential_sessions WHERE uid = ?',
        [uid]
      );
    });
  }

  deleteUser(uid: string): Promise<Result<boolean, Error>> {
    return this.admin(async (runner) => {
      const user = await this.user(runner, uid);
      // A missing foreign subject is not proof of completed cleanup for another provider.
      if (!user)
        throw new CredentialUnavailable(
          'Credential subject is not owned by the local provider'
        );
      await runner.query(
        'DELETE FROM local_credential_sessions WHERE uid = ?',
        [uid]
      );
      await runner.query(
        `UPDATE local_credential_users SET email = NULL, password_salt = NULL,
        password_hash = NULL, disabled = true, deleted = true, claims_json = '{}', created_at = 0, last_sign_in_at = NULL WHERE uid = ?`,
        [uid]
      );
    });
  }

  async generatePasswordResetLink(): Promise<Result<string, Error>> {
    return err(
      new CredentialUnavailable(
        'Local authentication has no email delivery channel'
      )
    );
  }
  async generateEmailVerificationLink(): Promise<Result<string, Error>> {
    return err(
      new CredentialUnavailable(
        'Local authentication has no email verification channel'
      )
    );
  }

  /** Operator-only provisioning seam. Never exposed through registration or a browser API. */
  async setOperatorClaims(
    uid: string,
    claims: Record<string, unknown>
  ): Promise<void> {
    authorizationClaims(claims);
    await this.transaction(async (runner) => {
      this.available(await this.user(runner, uid));
      await runner.query(
        'UPDATE local_credential_users SET claims_json = ? WHERE uid = ?',
        [JSON.stringify(claims), uid]
      );
      await runner.query(
        'DELETE FROM local_credential_sessions WHERE uid = ?',
        [uid]
      );
    });
  }

  async *capture(
    uid: string,
    signal: AbortSignal
  ): AsyncIterable<AccountExportEntry> {
    signal.throwIfAborted();
    const [user]: LocalUser[] = await this.source.query(
      'SELECT * FROM local_credential_users WHERE uid = ?',
      [uid]
    );
    if (!user || user.deleted || user.disabled)
      throw new CanonicalIdentityAccessDenied(
        'Credential account is unavailable'
      );
    signal.throwIfAborted();
    const sequence = new AccountExportCaptureSequence(this.name);
    yield sequence.accept({ type: 'begin', source: this.name, at: this.now() });
    yield sequence.accept({
      type: 'record',
      source: this.name,
      collection: 'credential-user',
      data: {
        uid: user.uid,
        email: user.email,
        emailVerified: false,
        createdAt: new Date(Number(user.created_at)).toISOString(),
        lastSignInAt:
          user.last_sign_in_at === null
            ? null
            : new Date(Number(user.last_sign_in_at)).toISOString(),
      },
    });
    signal.throwIfAborted();
    yield sequence.accept({
      type: 'end',
      source: this.name,
      at: this.now(),
      records: 1,
    });
  }

  private async issue(
    runner: QueryRunner,
    uid: string,
    authTime: number,
    refreshExpiry = this.now() + this.refreshSeconds * 1000
  ): Promise<AuthSessionDto> {
    await runner.query(
      'DELETE FROM local_credential_sessions WHERE uid = ? AND refresh_expires_at <= ?',
      [uid, this.now()]
    );
    const sessions: { access_hash: string }[] = await runner.query(
      'SELECT access_hash FROM local_credential_sessions WHERE uid = ? ORDER BY auth_time DESC, access_hash',
      [uid]
    );
    for (const session of sessions.slice(31))
      await runner.query(
        'DELETE FROM local_credential_sessions WHERE access_hash = ?',
        [session.access_hash]
      );
    const token = randomBytes(32).toString('base64url'),
      refreshToken = randomBytes(32).toString('base64url');
    await runner.query(
      `INSERT INTO local_credential_sessions
      (access_hash, refresh_hash, uid, auth_time, access_expires_at, refresh_expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        digest(token),
        digest(refreshToken),
        uid,
        authTime,
        this.now() + this.accessSeconds * 1000,
        refreshExpiry,
      ]
    );
    return { token, refreshToken, uid, expiresIn: String(this.accessSeconds) };
  }

  private async user(runner: QueryRunner, uid: string): Promise<LocalUser> {
    const [user]: LocalUser[] = await runner.query(
      'SELECT * FROM local_credential_users WHERE uid = ? FOR UPDATE',
      [uid]
    );
    return user;
  }
  private available(user: LocalUser | undefined): asserts user is LocalUser {
    if (!user || user.deleted || user.disabled) throw rejected();
  }
  private token(token: string): void {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw rejected();
  }
  private async transaction<T>(
    run: (runner: QueryRunner) => Promise<T>
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const runner = this.source.createQueryRunner();
      try {
        await runner.connect();
        await runner.startTransaction('READ COMMITTED');
        const result = await run(runner);
        await runner.commitTransaction();
        return result;
      } catch (error) {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        const code =
          error && typeof error === 'object' && 'code' in error
            ? error.code
            : null;
        if (
          attempt >= 2 ||
          !['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK'].includes(String(code))
        )
          throw error;
      } finally {
        await runner.release();
      }
    }
  }
  private async authentication<T>(
    run: () => Promise<T>
  ): Promise<Result<T, Error>> {
    try {
      return ok(await run());
    } catch (error) {
      return err(
        error instanceof CredentialRegistrationRejected
          ? error
          : new IdentityAuthenticationUnavailable(
              'Authentication service unavailable'
            )
      );
    }
  }
  private async admin(
    run: (runner: QueryRunner) => Promise<void>
  ): Promise<Result<boolean, Error>> {
    try {
      await this.transaction(run);
      return ok(true);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      )
        return err(
          new CredentialInputError('Credential email is already in use')
        );
      return err(
        error instanceof CredentialInputError ||
          error instanceof CredentialRegistrationRejected
          ? new CredentialInputError(error.message)
          : new CredentialUnavailable('Credential operation unavailable')
      );
    }
  }
}
