import type {
  CredentialEmailVerification,
  CredentialPasswordReset,
} from '@sdk/features/identity/libs/authentication';
import { IdentityAuthenticationUnavailable } from '@sdk/features/identity/libs/authentication';
import {
  PasswordRecoveryUnavailable,
  type PasswordRecovery,
} from '@sdk/features/identity/libs/management';
import type { MysqlLocalCredentials } from './mysql-local-credentials';

/** This simulator has no delivery channel or out-of-band proof of email control. */
export function localEmailVerification(
  credentials: MysqlLocalCredentials
): CredentialEmailVerification {
  const unsupported = async (): Promise<never> => {
    throw new IdentityAuthenticationUnavailable(
      'Email verification is unavailable in local authentication'
    );
  };
  return {
    status: async ({ uid, token }) => {
      const principal = await credentials.verifyIdToken(token);
      if (!principal.ok || principal.value.uid !== uid)
        throw new Error('Invalid session');
      return { email: principal.value.email ?? null, verified: false };
    },
    request: unsupported,
    verify: unsupported,
    complete: unsupported,
  };
}

export const localPasswordReset: CredentialPasswordReset = {
  verify: async () => {
    throw new IdentityAuthenticationUnavailable(
      'Local password recovery is unavailable'
    );
  },
  complete: async () => {
    throw new IdentityAuthenticationUnavailable(
      'Local password recovery is unavailable'
    );
  },
};

export const localPasswordRecovery: PasswordRecovery = {
  send: async () => {
    throw new PasswordRecoveryUnavailable(
      'Local password recovery is unavailable'
    );
  },
};
