import fetch from 'node-fetch';
import {
  CredentialEmailRequest,
  CredentialEmailSession,
  CredentialEmailStatus,
  CredentialEmailVerification,
  EmailVerificationAuthenticationRequired,
  EmailVerificationRejected,
  EmailVerificationThrottled,
  IdentityAuthenticationUnavailable,
} from '@sdk/features/identity/libs/authentication';
import { firebaseRestErrorCode } from './firebase-rest-session-gateway';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new IdentityAuthenticationUnavailable(
      'Invalid verification response'
    );
  return value as Record<string, unknown>;
}

function email(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+$/.test(value)
  )
    throw new IdentityAuthenticationUnavailable('Invalid credential email');
  return value;
}

export class FirebaseEmailVerification implements CredentialEmailVerification {
  constructor(
    private readonly apiKey: string,
    private readonly emulatorHost = process.env['FIREBASE_AUTH_EMULATOR_HOST']
  ) {
    if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY is required');
  }

  async status(
    session: CredentialEmailSession
  ): Promise<CredentialEmailStatus> {
    const data = await this.call('lookup', { idToken: session.token });
    if (!Array.isArray(data['users']) || data['users'].length !== 1)
      throw new IdentityAuthenticationUnavailable('Invalid credential lookup');
    const user = record(data['users'][0]);
    if (
      user['localId'] !== session.uid ||
      (user['disabled'] !== undefined && user['disabled'] !== false)
    )
      throw new EmailVerificationAuthenticationRequired(
        'Sign in again to verify your email.'
      );
    // REST omits false/default fields; malformed non-boolean values are never accepted.
    if (
      user['emailVerified'] !== undefined &&
      typeof user['emailVerified'] !== 'boolean'
    )
      throw new IdentityAuthenticationUnavailable(
        'Invalid verification status'
      );
    const address = user['email'] === undefined ? null : email(user['email']);
    if (!address && user['emailVerified'] === true)
      throw new IdentityAuthenticationUnavailable(
        'Verified credential has no email'
      );
    return { email: address, verified: user['emailVerified'] === true };
  }

  async request(
    session: CredentialEmailSession
  ): Promise<CredentialEmailRequest> {
    const current = await this.status(session);
    if (!current.email)
      throw new EmailVerificationRejected(
        'This sign-in account has no email address to verify.'
      );
    if (current.verified) return 'already-verified';
    const response = await this.call('sendOobCode', {
      requestType: 'VERIFY_EMAIL',
      idToken: session.token,
    });
    if (email(response['email']) !== current.email)
      throw new IdentityAuthenticationUnavailable(
        'Credential changed during verification request'
      );
    return 'requested';
  }

  async verify(code: string): Promise<void> {
    await this.inspect(code);
  }

  async complete(code: string): Promise<void> {
    const target = await this.inspect(code);
    const response = await this.call('update', { oobCode: code });
    if (
      email(response['email']) !== target ||
      (response['emailVerified'] !== undefined &&
        response['emailVerified'] !== true)
    )
      throw new IdentityAuthenticationUnavailable(
        'Email verification was not confirmed'
      );
  }

  private async inspect(code: string): Promise<string> {
    const response = await this.call('resetPassword', { oobCode: code });
    if (response['requestType'] !== 'VERIFY_EMAIL')
      throw new EmailVerificationRejected(
        'This link is not an email verification link. Request a new link in Profile Settings.'
      );
    return email(response['email']);
  }

  private async call(
    endpoint: string,
    body: Record<string, string>
  ): Promise<Record<string, unknown>> {
    const host = 'identitytoolkit.googleapis.com';
    const base = this.emulatorHost
      ? `http://${this.emulatorHost}/${host}`
      : `https://${host}`;
    try {
      const response = await fetch(
        `${base}/v1/accounts:${endpoint}?key=${encodeURIComponent(
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
      if (response.ok) return record(data);
      const code = firebaseRestErrorCode(data);
      if (
        response.status === 429 ||
        (response.status === 400 &&
          code &&
          ['TOO_MANY_ATTEMPTS_TRY_LATER', 'QUOTA_EXCEEDED'].includes(code))
      )
        throw new EmailVerificationThrottled(
          'Too many attempts. Please wait before trying again.'
        );
      if (
        response.status === 400 &&
        code &&
        ['EXPIRED_OOB_CODE', 'INVALID_OOB_CODE', 'EMAIL_NOT_FOUND'].includes(
          code
        )
      )
        throw new EmailVerificationRejected(
          'This verification link is invalid or no longer available. Refresh your status or request a new link in Profile Settings.'
        );
      if (
        response.status === 400 &&
        code &&
        [
          'USER_DISABLED',
          'USER_NOT_FOUND',
          'INVALID_ID_TOKEN',
          'TOKEN_EXPIRED',
          'CREDENTIAL_TOO_OLD_LOGIN_AGAIN',
        ].includes(code)
      )
        throw new EmailVerificationAuthenticationRequired(
          'Sign in again to verify your email.'
        );
      throw new IdentityAuthenticationUnavailable(
        'Email verification unavailable'
      );
    } catch (error) {
      if (
        error instanceof EmailVerificationRejected ||
        error instanceof EmailVerificationThrottled ||
        error instanceof EmailVerificationAuthenticationRequired
      )
        throw error;
      throw new IdentityAuthenticationUnavailable(
        'Email verification unavailable'
      );
    }
  }
}
