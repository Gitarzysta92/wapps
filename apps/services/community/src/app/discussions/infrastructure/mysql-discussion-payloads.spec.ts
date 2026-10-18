import { registeredDiscussionPayload } from './mysql-discussion-payloads';

const row = {
  nodeId: '00000000-0000-4000-8000-000000000001',
  objectKey:
    'discussions/00000000-0000-4000-8000-000000000001/versions/00000000-0000-4000-8000-000000000002.json',
  ownerIdentityId: null,
  actorIdentityId: null,
  tenantId: 'default',
  sha256: 'a'.repeat(64),
  bytes: 25,
  state: 'retired',
  registeredAt: 10,
  retiredAt: 20,
};

describe('anonymous Discussion payload registrations', () => {
  it('retains a validated anonymous retirement guard after private attribution is removed', () => {
    expect(registeredDiscussionPayload(row)).toMatchObject({
      ownerIdentityId: null,
      actorIdentityId: null,
      state: 'retired',
      retiredAt: 20,
      reference: { key: row.objectKey },
    });
    expect(
      registeredDiscussionPayload({
        ...row,
        state: 'committed',
        retiredAt: null,
      }).state
    ).toBe('committed');
  });
  it.each(['reserved', 'uploaded', 'anonymizing', 'retiring'])(
    'does not let an anonymous %s record lose its cleanup owner',
    (state) => {
      expect(() =>
        registeredDiscussionPayload({ ...row, state, retiredAt: null })
      ).toThrow();
    }
  );
  it.each([
    { actorIdentityId: 'RemainingActor' },
    { retiredAt: null },
    { retiredAt: 5 },
    { tenantId: ' default' },
    { objectKey: '../invalid.json' },
  ])('refuses inconsistent anonymous retirement metadata', (change) => {
    expect(() => registeredDiscussionPayload({ ...row, ...change })).toThrow();
  });
});
