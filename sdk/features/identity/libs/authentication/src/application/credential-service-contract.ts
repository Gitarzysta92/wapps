import { credentialSubject } from '@sdk/features/identity/core';

export const credentialOperations = [
  'password-session',
  'registration',
  'refresh',
  'verify-token',
  'revoke',
  'update',
  'delete',
  'export',
  'password-recovery',
  'password-reset-verify',
  'password-reset-complete',
  'email-status',
  'email-request',
  'email-verify',
  'email-complete',
  'password-reset-link',
  'email-verification-link',
] as const;
export type CredentialOperation = (typeof credentialOperations)[number];

export function credentialObject(
  input: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new Error('Invalid credential contract');
  return Object.fromEntries(Object.entries(input));
}
export function credentialText(input: unknown, max: number): string {
  if (
    typeof input !== 'string' ||
    !input.length ||
    input.length > max ||
    [...input].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  )
    throw new Error('Invalid credential contract');
  return input;
}

/** Shared transport schema. No Wapps identity, profile, ownership or lifecycle fields. */
export function credentialRequest(
  operation: CredentialOperation,
  input: unknown
): Record<string, unknown> {
  const keys: Record<CredentialOperation, readonly string[]> = {
    'password-session': ['email', 'password'],
    registration: ['email', 'password', 'key'],
    refresh: ['refreshToken'],
    'verify-token': ['token'],
    revoke: ['subject'],
    update: ['subject', 'patch'],
    delete: ['subject'],
    export: ['subject'],
    'password-recovery': ['email'],
    'password-reset-verify': ['code'],
    'password-reset-complete': ['code', 'password'],
    'email-status': ['subject', 'token'],
    'email-request': ['subject', 'token'],
    'email-verify': ['code'],
    'email-complete': ['code'],
    'password-reset-link': ['subject', 'email'],
    'email-verification-link': ['subject', 'email'],
  };
  if (!keys[operation]) throw new Error('Unknown credential operation');
  const body = credentialObject(input, keys[operation]);
  for (const key of keys[operation]) {
    if (key === 'patch') {
      const patch = credentialObject(body[key], [
        'email',
        'password',
        'providersToUnlink',
      ]);
      if (!Object.keys(patch).length) throw new Error('Empty credential patch');
      for (const field of Object.keys(patch)) {
        if (field === 'providersToUnlink') {
          const values = patch[field];
          if (
            !Array.isArray(values) ||
            !values.length ||
            values.length > 16 ||
            values.some(
              (value) =>
                !/^[a-zA-Z0-9.-]{1,128}$/.test(credentialText(value, 128))
            )
          )
            throw new Error('Invalid credential patch');
        } else credentialText(patch[field], field === 'email' ? 254 : 128);
      }
      body[key] = patch;
    } else {
      const value = credentialText(
        body[key],
        { email: 254, password: 128, key: 128, subject: 128, code: 2048 }[
          key
        ] ?? 16384
      );
      if (key === 'subject')
        credentialSubject({ issuer: 'validated', subject: value });
      if (key === 'key' && !/^[\x21-\x7e]{1,128}$/.test(value))
        throw new Error('Invalid enrollment key');
    }
  }
  return body;
}
