import { InjectionToken } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthSessionDto } from '@sdk/features/identity/libs/authentication';

export interface IdentityConnection {
  mode: 'api' | 'demo';
  authBaseUrl: string;
  accountBaseUrl: string;
}

export const IDENTITY_CONNECTION = new InjectionToken<IdentityConnection>(
  'IDENTITY_CONNECTION'
);

export function identityApiError(error: unknown, fallback: string): Error {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0 || error.status >= 500)
      return new Error(
        `${fallback} The service is unavailable. Please try again.`
      );
    if (error.status === 429)
      return new Error('Too many attempts. Please wait before trying again.');
    const body: unknown = error.error;
    if (
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string' &&
      body.error.length <= 300
    )
      return new Error(body.error);
    return new Error(fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

export function parseIdentitySession(value: unknown): AuthSessionDto {
  if (
    !value ||
    typeof value !== 'object' ||
    !('uid' in value) ||
    typeof value.uid !== 'string' ||
    !value.uid ||
    !('token' in value) ||
    typeof value.token !== 'string' ||
    !value.token ||
    !('refreshToken' in value) ||
    typeof value.refreshToken !== 'string' ||
    !value.refreshToken ||
    !('expiresIn' in value) ||
    typeof value.expiresIn !== 'string' ||
    !/^[1-9][0-9]*$/.test(value.expiresIn)
  )
    throw new Error(
      'The identity service returned an invalid session. Please sign in again.'
    );
  return {
    uid: value.uid,
    token: value.token,
    refreshToken: value.refreshToken,
    expiresIn: value.expiresIn,
  };
}

export function identityEndpoint(
  connection: IdentityConnection,
  kind: 'auth' | 'account',
  path: string
): string {
  if (connection.mode !== 'api')
    throw new Error(
      'This account operation requires a connected identity service. It is unavailable in demo mode.'
    );
  return `${(kind === 'auth'
    ? connection.authBaseUrl
    : connection.accountBaseUrl
  ).replace(/\/$/, '')}${path}`;
}
