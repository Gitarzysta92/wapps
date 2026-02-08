import fetch from 'node-fetch';
import { err, ok, Result } from '@foundation/standard';
import { AuthSessionDto, ISessionGateway } from '@domains/identity/authentication';

class FirebaseRestError extends Error {
  override name = 'FirebaseRestError';
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
  }
}

type FirebaseErrorResponse = {
  error?: {
    message?: string;
  };
};

type FirebaseSignInResponse = {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
};

type FirebaseRefreshResponse = {
  id_token: string;
  refresh_token: string;
  expires_in: string;
  user_id: string;
};

export class FirebaseRestSessionGateway implements ISessionGateway {
  constructor(private readonly apiKey: string | undefined) {}

  private ensureApiKey(): Result<string, Error> {
    if (!this.apiKey) {
      return err(new Error('FIREBASE_WEB_API_KEY not set'));
    }
    return ok(this.apiKey);
  }

  async signInWithPassword(email: string, password: string): Promise<Result<AuthSessionDto, Error>> {
    const apiKey = this.ensureApiKey();
    if (!apiKey.ok) return apiKey;

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey.value}`;
    return await this.postJson<FirebaseSignInResponse>(url, {
      email,
      password,
      returnSecureToken: true,
    });
  }

  async signUpAnonymous(): Promise<Result<AuthSessionDto, Error>> {
    const apiKey = this.ensureApiKey();
    if (!apiKey.ok) return apiKey;

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey.value}`;
    return await this.postJson<FirebaseSignInResponse>(url, {
      returnSecureToken: true,
    });
  }

  async signInWithCustomToken(customToken: string): Promise<Result<AuthSessionDto, Error>> {
    const apiKey = this.ensureApiKey();
    if (!apiKey.ok) return apiKey;

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey.value}`;
    return await this.postJson<FirebaseSignInResponse>(url, {
      token: customToken,
      returnSecureToken: true,
    });
  }

  async refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>> {
    const apiKey = this.ensureApiKey();
    if (!apiKey.ok) return apiKey;

    const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey.value}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      const data = (await res.json()) as FirebaseRefreshResponse | FirebaseErrorResponse;

      if (!res.ok) {
        const code = (data as FirebaseErrorResponse)?.error?.message;
        return err(new FirebaseRestError('Invalid refresh token', code));
      }

      const okData = data as FirebaseRefreshResponse;
      return ok({
        token: okData.id_token,
        refreshToken: okData.refresh_token,
        expiresIn: okData.expires_in,
        uid: okData.user_id,
      });
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Token refresh failed';
      return err(new FirebaseRestError(message));
    }
  }

  private async postJson<T extends FirebaseSignInResponse>(
    url: string,
    body: Record<string, unknown>
  ): Promise<Result<AuthSessionDto, Error>> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as T | FirebaseErrorResponse;

      if (!res.ok) {
        const code = (data as FirebaseErrorResponse)?.error?.message;
        return err(new FirebaseRestError('Firebase auth error', code));
      }

      const okData = data as T;
      return ok({
        token: okData.idToken,
        refreshToken: okData.refreshToken,
        expiresIn: okData.expiresIn,
        uid: okData.localId,
      });
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Firebase request failed';
      return err(new FirebaseRestError(message));
    }
  }
}

