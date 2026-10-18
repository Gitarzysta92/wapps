import { isEmail } from 'class-validator';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';

export type AccountAdminAction =
  | 'disable'
  | 'enable'
  | 'revoke-tokens'
  | 'delete'
  | 'email'
  | 'password'
  | 'unlink-providers'
  | 'generate-password-reset-link'
  | 'generate-email-verification-link'
  | 'identity'
  | 'deletion-status';

export const accountAdminOperations = {
  disable: { method: 'POST', status: 201, field: 'disabled' },
  enable: { method: 'POST', status: 201, field: 'enabled' },
  'revoke-tokens': { method: 'POST', status: 201, field: 'revoked' },
  delete: { method: 'DELETE', status: 202, field: 'deletion' },
  email: { method: 'PATCH', status: 200, field: 'updated' },
  password: { method: 'PATCH', status: 200, field: 'updated' },
  'unlink-providers': { method: 'POST', status: 201, field: 'updated' },
  'generate-password-reset-link': {
    method: 'POST',
    status: 201,
    field: 'link',
  },
  'generate-email-verification-link': {
    method: 'POST',
    status: 201,
    field: 'link',
  },
  identity: { method: 'GET', status: 200, field: 'identity' },
  'deletion-status': { method: 'GET', status: 200, field: 'deletion' },
} as const;

function object(input: unknown, fields: string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== fields.length ||
    fields.some((field) => !Object.prototype.hasOwnProperty.call(input, field))
  )
    throw new Error('Invalid account administration contract');
  return input as Record<string, unknown>;
}

export function accountAdminInput(action: AccountAdminAction, input: unknown) {
  const field =
    action === 'password'
      ? 'password'
      : action === 'unlink-providers'
      ? 'providersToUnlink'
      : 'email';
  const body = object(input, [field]);
  const value = body[field];
  if (field === 'email') {
    if (typeof value !== 'string' || value.length > 254 || !isEmail(value))
      throw new Error('Invalid email');
  } else if (field === 'password') {
    if (typeof value !== 'string' || value.length < 6 || value.length > 128)
      throw new Error('Invalid password');
  } else if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 16 ||
    new Set(value).size !== value.length ||
    value.some(
      (provider) =>
        typeof provider !== 'string' || !/^[a-zA-Z0-9.-]{1,128}$/.test(provider)
    )
  ) {
    throw new Error('Invalid providers');
  }
  return { [field]: value };
}

export function accountAdminReceipt(
  action: AccountAdminAction,
  uid: string,
  input: unknown
) {
  if (input === null && (action === 'identity' || action === 'deletion-status'))
    return null;
  const field = accountAdminOperations[action].field;
  if (field === 'identity' || field === 'deletion') {
    const value = object(
      input,
      field === 'identity'
        ? [
            'identityId',
            'subjectId',
            'revision',
            'isActive',
            'isSuspended',
            'isDeleted',
          ]
        : ['identityId', 'revision', 'status', 'cleanup']
    );
    if (
      value['identityId'] !== uid ||
      !Number.isSafeInteger(value['revision']) ||
      Number(value['revision']) < 1
    )
      throw new Error('Invalid identity receipt');
    if (field === 'identity') {
      if (
        !isCanonicalIdentityId(value['subjectId']) ||
        ['isActive', 'isSuspended', 'isDeleted'].some(
          (key) => typeof value[key] !== 'boolean'
        ) ||
        (value['isDeleted'] && value['isActive'])
      )
        throw new Error('Invalid identity state');
    } else if (
      value['status'] !== 'accepted' ||
      !['pending', 'completed', 'failed'].includes(String(value['cleanup']))
    ) {
      throw new Error('Invalid deletion receipt');
    }
    return value;
  }
  const value = object(input, [field]);
  if (field === 'link') {
    const link = value[field];
    if (typeof link !== 'string' || link.length > 8192 || /\s/.test(link))
      throw new Error('Invalid action link');
    const url = new URL(link);
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error('Invalid action link');
  } else if (value[field] !== true)
    throw new Error('Unconfirmed account command');
  return value;
}
