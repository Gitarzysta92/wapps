import fetch from 'node-fetch';
import {
  CredentialPasswordReset,
  IdentityAuthenticationUnavailable,
  PasswordResetRejected,
} from '@sdk/features/identity/libs/authentication';
import { firebaseRestErrorCode } from './firebase-rest-session-gateway';

export class FirebasePasswordReset implements CredentialPasswordReset {
  constructor(
    private readonly apiKey: string,
    private readonly emulatorHost = process.env['FIREBASE_AUTH_EMULATOR_HOST']
  ) {
    if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY is required');
  }

  verify(code: string): Promise<void> {
    return this.request({ oobCode: code });
  }
  async complete(code: string, password: string): Promise<void> {
    await this.verify(code);
    await this.request({ oobCode: code, newPassword: password });
  }

  private async request(body: {
    oobCode: string;
    newPassword?: string;
  }): Promise<void> {
    const host = 'identitytoolkit.googleapis.com';
    const base = this.emulatorHost
      ? `http://${this.emulatorHost}/${host}`
      : `https://${host}`;
    try {
      const response = await fetch(
        `${base}/v1/accounts:resetPassword?key=${encodeURIComponent(
          this.apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          timeout: 10_000,
          size: 16 * 1024,
        }
      );
      const data: unknown = await response.json();
      if (!response.ok) {
        const code = firebaseRestErrorCode(data);
        if (
          response.status === 400 &&
          code &&
          [
            'EXPIRED_OOB_CODE',
            'INVALID_OOB_CODE',
            'USER_DISABLED',
            'EMAIL_NOT_FOUND',
          ].includes(code)
        )
          throw new PasswordResetRejected(
            'This reset link is invalid or no longer available. Request a new link.'
          );
        if (
          response.status === 400 &&
          code &&
          ['WEAK_PASSWORD', 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS'].includes(
            code
          )
        )
          throw new PasswordResetRejected(
            'This password does not meet the account password policy. Choose a stronger password.'
          );
        throw new IdentityAuthenticationUnavailable(
          'Password reset service unavailable'
        );
      }
      if (
        !data ||
        typeof data !== 'object' ||
        !('email' in data) ||
        typeof data.email !== 'string' ||
        !data.email.includes('@')
      )
        throw new IdentityAuthenticationUnavailable(
          'Invalid password reset response'
        );
      if (
        !body.newPassword &&
        (!('requestType' in data) || data.requestType !== 'PASSWORD_RESET')
      )
        throw new PasswordResetRejected(
          'This link is not a password reset link. Request a new reset link.'
        );
    } catch (error) {
      if (error instanceof PasswordResetRejected) throw error;
      throw new IdentityAuthenticationUnavailable(
        'Password reset service unavailable'
      );
    }
  }
}
