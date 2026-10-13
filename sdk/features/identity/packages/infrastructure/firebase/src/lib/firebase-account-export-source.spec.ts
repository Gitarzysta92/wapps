import type * as admin from 'firebase-admin';
import {
  AccountExportSourceInvalid,
  CanonicalIdentityAccessDenied,
  type AccountExportEntry,
} from '@sdk/features/identity/core';
import { FirebaseAccountExportSource } from './firebase-account-export-source';

async function collect(input: AsyncIterable<AccountExportEntry>) {
  const rows: AccountExportEntry[] = [];
  for await (const row of input) rows.push(row);
  return rows;
}
function fixture() {
  const user = {
    uid: 'Member',
    disabled: false,
    email: 'member@example.test',
    emailVerified: true,
    displayName: 'Member',
    phoneNumber: '+48123456789',
    photoURL: 'https://example.test/photo',
    metadata: {
      creationTime: 'Mon, 12 Oct 2026 00:00:00 GMT',
      lastSignInTime: 'Mon, 12 Oct 2026 01:00:00 GMT',
      lastRefreshTime: '2026-10-12T01:00:01.000Z',
    },
    tokensValidAfterTime: 'Mon, 12 Oct 2026 00:00:00 GMT',
    providerData: [
      {
        providerId: 'google.com',
        uid: 'ProviderMember',
        email: 'member@example.test',
        displayName: 'Member',
      },
    ],
    multiFactor: {
      enrolledFactors: [
        {
          uid: 'factor-1',
          factorId: 'phone',
          phoneNumber: '+48123456789',
          displayName: 'Phone',
          enrollmentTime: 'Mon, 12 Oct 2026 00:00:00 GMT',
        },
      ],
    },
    customClaims: { admin: true, internal: 'private claim' },
    passwordHash: 'password secret',
    passwordSalt: 'salt secret',
    toJSON: jest.fn(),
  };
  const getUser = jest
    .fn<Promise<admin.auth.UserRecord>, [string]>()
    .mockResolvedValue(user as unknown as admin.auth.UserRecord);
  return {
    user,
    getUser,
    controller: new AbortController(),
    source: new FirebaseAccountExportSource(
      () => ({ getUser }),
      () => 100,
      100
    ),
  };
}
describe('safe credential account export', () => {
  it('exports only owner profile, provider metadata and factor enrollment details', async () => {
    const f = fixture();
    const rows = await collect(f.source.capture('Member', f.controller.signal));
    expect(rows[0]).toEqual({ type: 'begin', source: 'credentials', at: 100 });
    expect(rows[1]).toMatchObject({
      type: 'record',
      collection: 'credential-user',
      data: {
        uid: 'Member',
        emailVerified: true,
        createdAt: '2026-10-12T00:00:00.000Z',
      },
    });
    expect(rows[2]).toMatchObject({
      collection: 'linked-provider',
      data: { uid: 'ProviderMember', providerId: 'google.com' },
    });
    expect(rows[3]).toMatchObject({
      collection: 'multi-factor-enrollment',
      data: { id: 'factor-1', kind: 'phone' },
    });
    expect(rows[4]).toEqual({
      type: 'end',
      source: 'credentials',
      at: 100,
      records: 3,
    });
    expect(f.getUser).toHaveBeenCalledWith('Member');
    for (const secret of [
      'private claim',
      'password secret',
      'salt secret',
      'customClaims',
      'passwordHash',
      'passwordSalt',
    ])
      expect(JSON.stringify(rows)).not.toContain(secret);
    expect(f.user.toJSON).not.toHaveBeenCalled();
  });
  it.each([{ uid: 'Other' }, { disabled: true }])(
    'rejects foreign or disabled credentials: %j',
    async (patch) => {
      const f = fixture();
      Object.assign(f.user, patch);
      await expect(
        collect(f.source.capture('Member', f.controller.signal))
      ).rejects.toBeInstanceOf(CanonicalIdentityAccessDenied);
    }
  );
  it.each([
    { emailVerified: 'yes' },
    { disabled: 0 },
    { providerData: [{ providerId: 'google.com' }] },
    { metadata: { creationTime: 'not a date' } },
  ])('rejects malformed provider records: %j', async (patch) => {
    const f = fixture();
    Object.assign(f.user, patch);
    await expect(
      collect(f.source.capture('Member', f.controller.signal))
    ).rejects.toBeInstanceOf(AccountExportSourceInvalid);
  });
  it('represents optional absent data explicitly', async () => {
    const f = fixture();
    f.getUser.mockResolvedValue({
      uid: 'Member',
      disabled: false,
      emailVerified: false,
      metadata: {},
      providerData: [],
    } as unknown as admin.auth.UserRecord);
    const rows = await collect(f.source.capture('Member', f.controller.signal));
    expect(rows[1]).toMatchObject({
      data: { email: null, phoneNumber: null, createdAt: null },
    });
    expect(rows[2]).toMatchObject({ type: 'end', records: 1 });
  });
  it('terminates a missing credential capture and preserves provider outages as failures', async () => {
    const f = fixture();
    f.getUser.mockRejectedValue({ code: 'auth/user-not-found' });
    await expect(
      collect(f.source.capture('Member', f.controller.signal))
    ).rejects.toBeInstanceOf(CanonicalIdentityAccessDenied);
    f.getUser.mockRejectedValue(new Error('provider offline'));
    await expect(
      collect(f.source.capture('Member', f.controller.signal))
    ).rejects.toThrow('provider offline');
  });
  it('returns on timeout even if the SDK call never resolves', async () => {
    const f = fixture();
    f.getUser.mockImplementation(() => new Promise(() => undefined));
    await expect(
      collect(f.source.capture('Member', f.controller.signal))
    ).rejects.toThrow('timed out');
  });
  it('stops on cancellation and ignores a late provider response', async () => {
    const f = fixture();
    let finish: (value: admin.auth.UserRecord) => void = () => undefined;
    f.getUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const result = collect(f.source.capture('Member', f.controller.signal));
    const rejected = expect(result).rejects.toThrow('cancel capture');
    f.controller.abort(new Error('cancel capture'));
    await rejected;
    finish(f.user as unknown as admin.auth.UserRecord);
    await new Promise((resolve) => setImmediate(resolve));
    expect(f.user.toJSON).not.toHaveBeenCalled();
  });
});
