import {
  CanonicalIdentityInputError,
  isCanonicalIdentityId,
} from './canonical-identity';

export const ACCOUNT_ERASURE_PARTICIPANTS = [
  'account',
  'editorial',
  'discussion',
] as const;
export type AccountErasureParticipantName =
  (typeof ACCOUNT_ERASURE_PARTICIPANTS)[number];
export interface AccountErasureRequest {
  identityId: string;
  revision: number;
}
export interface AccountErasureReceipt extends AccountErasureRequest {
  participant: AccountErasureParticipantName;
  state: 'pending' | 'completed';
}

function fields(
  input: unknown,
  names: readonly string[]
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== names.length ||
    Object.keys(input).some((key) => !names.includes(key))
  )
    throw new CanonicalIdentityInputError('Invalid account erasure contract');
  return input as Record<string, unknown>;
}
export function accountErasureRequest(input: unknown): AccountErasureRequest {
  const value = fields(input, ['identityId', 'revision']);
  if (
    !isCanonicalIdentityId(value['identityId']) ||
    typeof value['revision'] !== 'number' ||
    !Number.isSafeInteger(value['revision']) ||
    value['revision'] < 1
  )
    throw new CanonicalIdentityInputError(
      'Invalid account erasure identity or revision'
    );
  return { identityId: value['identityId'], revision: value['revision'] };
}
export function accountErasureReceipt(input: unknown): AccountErasureReceipt {
  const value = fields(input, [
    'participant',
    'identityId',
    'revision',
    'state',
  ]);
  if (
    (value['participant'] !== 'account' &&
      value['participant'] !== 'editorial' &&
      value['participant'] !== 'discussion') ||
    (value['state'] !== 'pending' && value['state'] !== 'completed')
  )
    throw new CanonicalIdentityInputError('Invalid account erasure receipt');
  return {
    ...accountErasureRequest({
      identityId: value['identityId'],
      revision: value['revision'],
    }),
    participant: value['participant'],
    state: value['state'],
  };
}
