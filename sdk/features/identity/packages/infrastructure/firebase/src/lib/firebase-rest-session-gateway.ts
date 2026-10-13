import fetch from 'node-fetch';
import { err, ok, Result } from '@sdk/kernel/standard';
import {
  AuthSessionDto,
  CredentialRegistrationRejected,
  IdentityAuthenticationUnavailable,
  RegistrationCredentials,
} from '@sdk/features/identity/libs/authentication';

export type FirebaseAuthSessionDto = AuthSessionDto;

class FirebaseRestError extends Error {
  constructor(public readonly code: string) {
    super('Credentials were rejected. Check your details and try again.');
  }
}

export function firebaseRestErrorCode(input: unknown): string | null {
  if (
    !input ||
    typeof input !== 'object' ||
    !('error' in input) ||
    !input.error ||
    typeof input.error !== 'object' ||
    !('message' in input.error) ||
    typeof input.error.message !== 'string'
  )
    return null;
  return input.error.message.split(' : ')[0];
}

function unavailable(): IdentityAuthenticationUnavailable {
  return new IdentityAuthenticationUnavailable(
    'Authentication service unavailable'
  );
}

export class FirebaseRestSessionGateway implements RegistrationCredentials {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly emulatorHost = process.env['FIREBASE_AUTH_EMULATOR_HOST']
  ) {}

  async registerOrAuthenticate(
    email: string,
    password: string
  ): Promise<Result<AuthSessionDto, Error>> {
    const created = await this.request(
      'identitytoolkit.googleapis.com',
      '/v1/accounts:signUp',
      {
        email,
        password,
        returnSecureToken: true,
      }
    );
    // A previous attempt may have created credentials before its SQL transaction failed.
    const result =
      !created.ok &&
      created.error instanceof FirebaseRestError &&
      created.error.code === 'EMAIL_EXISTS'
        ? await this.signInWithPassword(email, password)
        : created;
    return !result.ok && result.error instanceof FirebaseRestError
      ? err(
          new CredentialRegistrationRejected(
            'Registration could not be completed. Check your details or sign in.'
          )
        )
      : result;
  }

  signInWithPassword(
    email: string,
    password: string
  ): Promise<Result<AuthSessionDto, Error>> {
    return this.request(
      'identitytoolkit.googleapis.com',
      '/v1/accounts:signInWithPassword',
      {
        email,
        password,
        returnSecureToken: true,
      }
    );
  }

  signUpAnonymous(): Promise<Result<AuthSessionDto, Error>> {
    return this.request(
      'identitytoolkit.googleapis.com',
      '/v1/accounts:signUp',
      { returnSecureToken: true }
    );
  }

  signInWithCustomToken(
    customToken: string
  ): Promise<Result<AuthSessionDto, Error>> {
    return this.request(
      'identitytoolkit.googleapis.com',
      '/v1/accounts:signInWithCustomToken',
      {
        token: customToken,
        returnSecureToken: true,
      }
    );
  }

  refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>> {
    return this.request(
      'securetoken.googleapis.com',
      '/v1/token',
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      true
    );
  }

  private async request(
    host: string,
    path: string,
    body: Record<string, unknown>,
    refresh = false
  ): Promise<Result<AuthSessionDto, Error>> {
    if (!this.apiKey) return err(unavailable());
    const base = this.emulatorHost
      ? `http://${this.emulatorHost}/${host}`
      : `https://${host}`;
    try {
      const response = await fetch(
        `${base}${path}?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          timeout: 10_000,
          size: 32 * 1024,
        }
      );
      const data: unknown = await response.json();
      if (!response.ok) {
        const code = firebaseRestErrorCode(data);
        const rejected = [
          'EMAIL_EXISTS',
          'EMAIL_NOT_FOUND',
          'INVALID_PASSWORD',
          'INVALID_LOGIN_CREDENTIALS',
          'USER_DISABLED',
          'WEAK_PASSWORD',
          'PASSWORD_DOES_NOT_MEET_REQUIREMENTS',
          'INVALID_EMAIL',
          'INVALID_REFRESH_TOKEN',
          'TOKEN_EXPIRED',
          'USER_NOT_FOUND',
          'INVALID_CUSTOM_TOKEN',
          'CREDENTIAL_MISMATCH',
        ];
        return err(
          response.status === 400 && code && rejected.includes(code)
            ? new FirebaseRestError(code)
            : unavailable()
        );
      }
      if (!data || typeof data !== 'object') return err(unavailable());
      const values: Record<string, unknown> = data as Record<string, unknown>;
      const token = values[refresh ? 'id_token' : 'idToken'];
      const refreshToken = values[refresh ? 'refresh_token' : 'refreshToken'];
      const expiresIn = values[refresh ? 'expires_in' : 'expiresIn'];
      const uid = values[refresh ? 'user_id' : 'localId'];
      if (
        typeof token !== 'string' ||
        token.length === 0 ||
        token.length > 16384 ||
        typeof refreshToken !== 'string' ||
        refreshToken.length === 0 ||
        refreshToken.length > 16384 ||
        typeof expiresIn !== 'string' ||
        !/^[1-9][0-9]*$/.test(expiresIn) ||
        !Number.isSafeInteger(Number(expiresIn)) ||
        typeof uid !== 'string' ||
        uid.length === 0 ||
        uid.length > 128 ||
        uid.trim() !== uid ||
        [...uid].some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        )
      )
        return err(unavailable());
      return ok({ token, refreshToken, expiresIn, uid });
    } catch {
      return err(unavailable());
    }
  }
}
