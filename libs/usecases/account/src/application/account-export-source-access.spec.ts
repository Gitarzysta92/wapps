import { err, ok } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import {
  AccountExportSourceAccess,
  ACCOUNT_EXPORT_READER,
  ACCOUNT_EXPORT_READER_ROLE,
  ACCOUNT_EXPORT_READER_SCOPE,
} from './account-export-source-access';

const actor = {
  identityId: ACCOUNT_EXPORT_READER,
  tenantId: ACCOUNT_EXPORT_READER_SCOPE,
  roles: [ACCOUNT_EXPORT_READER_ROLE],
};
function fixture() {
  const capture = jest.fn().mockReturnValue(
    (async function* () {
      yield { type: 'begin', source: 'discussion', at: 1 };
    })()
  );
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  return {
    capture,
    evaluate,
    access: new AccountExportSourceAccess(
      { name: 'discussion', capture },
      { evaluate }
    ),
  };
}
describe('internal account export source access', () => {
  it('binds the policy to the fixed service purpose and the exact requested owner', async () => {
    const f = fixture(),
      signal = new AbortController().signal;
    await f.access.capture({ identityId: 'Member' }, actor, signal);
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: ACCOUNT_EXPORT_READER,
        tenantId: ACCOUNT_EXPORT_READER_SCOPE,
        actionName: 'discussion.account-export.read',
        subject: { roles: [ACCOUNT_EXPORT_READER_ROLE] },
        resource: {
          type: 'account-export',
          id: 'Member',
          tenantId: ACCOUNT_EXPORT_READER_SCOPE,
        },
      })
    );
    expect(f.capture).toHaveBeenCalledWith('Member', signal);
  });
  it.each([
    { identityId: 'Member' },
    { tenantId: 'default' },
    { roles: ['admin'] },
    { roles: [] },
    { roles: [ACCOUNT_EXPORT_READER_ROLE, 'admin'] },
  ])(
    'rejects user/scope/role substitution before policy or source access: %p',
    async (change) => {
      const f = fixture();
      await expect(
        f.access.capture(
          { identityId: 'Member' },
          { ...actor, ...change },
          new AbortController().signal
        )
      ).rejects.toBeInstanceOf(CanonicalIdentityAccessDenied);
      expect(f.evaluate).not.toHaveBeenCalled();
      expect(f.capture).not.toHaveBeenCalled();
    }
  );
  it.each([
    null,
    [],
    {},
    { identityId: ' ' },
    { identityId: 'Member', tenantId: 'foreign' },
    { identityId: 'Member', roles: ['admin'] },
  ])('rejects injected scope and malformed requests: %p', async (input) => {
    const f = fixture();
    await expect(
      f.access.capture(input, actor, new AbortController().signal)
    ).rejects.toBeInstanceOf(CanonicalIdentityInputError);
    expect(f.evaluate).not.toHaveBeenCalled();
    expect(f.capture).not.toHaveBeenCalled();
  });
  it.each([false, null, 'true'])(
    'requires a literal policy allow: %p',
    async (value) => {
      const f = fixture();
      f.evaluate.mockResolvedValue(ok(value));
      await expect(
        f.access.capture(
          { identityId: 'Member' },
          actor,
          new AbortController().signal
        )
      ).rejects.toBeInstanceOf(CanonicalIdentityAccessDenied);
      expect(f.capture).not.toHaveBeenCalled();
    }
  );
  it('fails closed on policy outage and cancelled authorization', async () => {
    const f = fixture(),
      controller = new AbortController();
    f.evaluate.mockResolvedValue(err(new Error('offline')));
    await expect(
      f.access.capture({ identityId: 'Member' }, actor, controller.signal)
    ).rejects.toBeInstanceOf(CanonicalIdentityUnavailable);
    f.evaluate.mockImplementation(async () => {
      controller.abort(new Error('Cancelled'));
      return ok(true);
    });
    await expect(
      f.access.capture({ identityId: 'Member' }, actor, controller.signal)
    ).rejects.toThrow('Cancelled');
    expect(f.capture).not.toHaveBeenCalled();
  });
});
