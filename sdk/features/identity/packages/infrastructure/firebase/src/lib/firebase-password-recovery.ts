import fetch from 'node-fetch';
import {
  PasswordRecovery,
  PasswordRecoveryUnavailable,
} from '@sdk/features/identity/libs/management';

export class FirebasePasswordRecovery implements PasswordRecovery {
  constructor(
    private readonly apiKey: string,
    private readonly emulatorHost = process.env['FIREBASE_AUTH_EMULATOR_HOST']
  ) {
    if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY is required');
  }

  async send(email: string): Promise<void> {
    const host = 'identitytoolkit.googleapis.com';
    const base = this.emulatorHost
      ? `http://${this.emulatorHost}/${host}`
      : `https://${host}`;
    try {
      const response = await fetch(
        `${base}/v1/accounts:sendOobCode?key=${encodeURIComponent(
          this.apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
          timeout: 10_000,
          size: 16 * 1024,
        }
      );
      const result: unknown = await response.json();
      if (response.ok) return;
      // Firebase projects without enumeration protection return this for an unknown email.
      if (
        response.status === 400 &&
        result &&
        typeof result === 'object' &&
        'error' in result &&
        result.error &&
        typeof result.error === 'object' &&
        'message' in result.error &&
        result.error.message === 'EMAIL_NOT_FOUND'
      )
        return;
      throw new PasswordRecoveryUnavailable(
        'Password recovery delivery unavailable'
      );
    } catch {
      throw new PasswordRecoveryUnavailable(
        'Password recovery delivery unavailable'
      );
    }
  }
}
