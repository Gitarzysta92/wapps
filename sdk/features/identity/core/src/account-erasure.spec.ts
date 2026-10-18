import {
  accountErasureReceipt,
  accountErasureRequest,
} from './account-erasure';
import { CanonicalIdentityInputError } from './canonical-identity';

describe('account erasure contracts', () => {
  const request = { identityId: 'Member', revision: 7 };
  it('preserves case-sensitive identity and the exact deletion revision', () => {
    expect(accountErasureRequest(request)).toEqual(request);
    expect(
      accountErasureRequest({ ...request, identityId: 'member' })
    ).not.toEqual(request);
  });
  it.each([
    null,
    [],
    {},
    { ...request, extra: true },
    { ...request, identityId: '' },
    { ...request, revision: '7' },
    { ...request, revision: 0 },
    { ...request, revision: 1.5 },
    { ...request, revision: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects malformed requests: %j', (input) =>
    expect(() => accountErasureRequest(input)).toThrow(
      CanonicalIdentityInputError
    )
  );
  it.each(['alpha', 'Vendor:Export/v9', 'OTHER'])(
    'accepts pending and completed receipts from %s',
    (participant) => {
      for (const state of ['pending', 'completed']) {
        const receipt = { ...request, participant, state };
        expect(accountErasureReceipt(receipt)).toEqual(receipt);
      }
    }
  );
  it.each([
    { participant: '', state: 'pending' },
    { participant: 'account', state: 'accepted' },
    { participant: 'editorial', state: 'completed', revision: '7' },
    { participant: 'discussion', state: 'completed', extra: true },
  ])(
    'rejects unrecognized or incomplete completion contracts: %j',
    (receipt) => {
      expect(() => accountErasureReceipt({ ...request, ...receipt })).toThrow(
        CanonicalIdentityInputError
      );
    }
  );
});
