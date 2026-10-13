import {
  parsePrivateProfile,
  parseProfileContactEmail,
  parseProfileSocialLinks,
  parseProfileUpdate,
  parseProfileUpdateReceipt,
} from './private-profile';

const update = {
  expectedRevision: 2,
  name: 'Alice',
  bio: null,
  location: null,
  socialLinks: {},
};
const snapshot = {
  identityId: 'CaseSensitiveUid',
  revision: 3,
  registeredAt: 100,
  updatedAt: 200,
  profile: {
    name: 'Alice',
    bio: null,
    location: null,
    avatarUri: null,
    socialLinks: {},
  },
};

describe('private profile contract', () => {
  it('keeps omitted contact commands unchanged and distinguishes explicit removal', () => {
    expect(parseProfileUpdate(update)).toEqual(update);
    expect(parseProfileUpdate({ ...update, contactEmail: undefined })).toEqual(update);
    expect(parseProfileUpdate({ ...update, contactEmail: '' })).toEqual({ ...update, contactEmail: null });
    expect(parseProfileContactEmail(' Alice+hello@EXAMPLE.Test ')).toBe('Alice+hello@example.test');
    expect(() => parsePrivateProfile({ ...snapshot, registeredAt: null, profile: { ...snapshot.profile, name: null, contactEmail: 'alice@example.test' } })).toThrow();
  });
  it.each([
    'Alice <alice@example.test>', 'alice@example.test,bob@example.test',
    'alice@example.test\r\nBcc: other@example.test', 'alice@example.test?subject=hello',
    'alice@localhost', 'a..b@example.test', '.alice@example.test', 'alice.@example.test',
    'a@-example.test', 'a@example..test', 'a@' + 'x'.repeat(64) + '.test',
    'a'.repeat(65) + '@example.test', 'alice@ex\u00e4mple.test', 123, {}, undefined,
  ])('rejects malformed, international or header-bearing contact values: %j', (value) => {
    expect(() => parseProfileContactEmail(value)).toThrow();
  });
  it('normalizes editable text and deterministic social-link ordering', () => {
    expect(
      parseProfileUpdate({
        ...update,
        name: ' Alice ',
        bio: ' Hello\nworld ',
        location: ' ',
        socialLinks: {
          website: ' https://example.test ',
          github: '@alice',
          twitter: '',
        },
      })
    ).toEqual({
      ...update,
      bio: 'Hello\nworld',
      socialLinks: { github: '@alice', website: 'https://example.test' },
    });
    expect(
      JSON.stringify(
        parseProfileSocialLinks({
          website: 'https://example.test',
          github: 'alice',
        })
      )
    ).toBe(
      JSON.stringify(
        parseProfileSocialLinks({
          github: 'alice',
          website: 'https://example.test',
        })
      )
    );
  });
  it.each([
    null,
    [],
    {},
    { ...update, identityId: 'Other' },
    { ...update, avatarUri: 'data:image/png;base64,eA==' },
    { ...update, name: ' ' },
    { ...update, name: 'x'.repeat(121) },
    { ...update, bio: 'x'.repeat(501) },
    { ...update, location: 'x'.repeat(121) },
    { ...update, name: 'A\nB' },
    { ...update, bio: '\u0000' },
    { ...update, expectedRevision: '2' },
    { ...update, expectedRevision: 0 },
    { ...update, expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...update, socialLinks: { unknown: 'https://example.test' } },
    { ...update, socialLinks: null },
  ])('rejects invalid commands without ignoring fields: %j', (input) =>
    expect(() => parseProfileUpdate(input)).toThrow()
  );
  it.each([
    'javascript:alert(1)',
    'data:text/html,content',
    '//example.test',
    'https://user:secret@example.test',
    'https://example.test/a b',
    'https:example.test',
    'not-a-url',
  ])('rejects unsafe or malformed links: %s', (value) =>
    expect(() => parseProfileSocialLinks({ website: value })).toThrow()
  );
  it('supports bounded social handles and absolute URLs', () => {
    expect(
      parseProfileSocialLinks({
        twitter: '@alice',
        github: 'alice-dev',
        linkedin: 'https://linkedin.com/in/alice',
      })
    ).toEqual({
      twitter: '@alice',
      github: 'alice-dev',
      linkedin: 'https://linkedin.com/in/alice',
    });
    expect(() =>
      parseProfileSocialLinks({ twitter: '@' + 'a'.repeat(16) })
    ).toThrow();
    expect(() =>
      parseProfileSocialLinks({ github: '@' + 'a'.repeat(40) })
    ).toThrow();
  });
  it('preserves canonical identity, revision and absent media without inventing metrics', () =>
    expect(parsePrivateProfile(snapshot)).toEqual(snapshot));
  it('represents a real unregistered account with null fields', () => {
    const stub = {
      ...snapshot,
      registeredAt: null,
      profile: { ...snapshot.profile, name: null },
    };
    expect(parsePrivateProfile(stub)).toEqual(stub);
    expect(() =>
      parsePrivateProfile({ ...snapshot, registeredAt: null })
    ).toThrow();
  });
  it.each([
    { ...snapshot, identityId: ' UID ' },
    { ...snapshot, revision: '3' },
    { ...snapshot, registeredAt: 300 },
    { ...snapshot, updatedAt: 8_640_000_000_000_001 },
    { ...snapshot, stats: {} },
    { ...snapshot, profile: { ...snapshot.profile, name: null } },
    {
      ...snapshot,
      profile: { ...snapshot.profile, avatarUri: 'javascript:alert(1)' },
    },
  ])('rejects malformed server snapshots: %j', (input) =>
    expect(() => parsePrivateProfile(input)).toThrow()
  );
  it('requires an exact durable command receipt', () => {
    expect(
      parseProfileUpdateReceipt({ identityId: 'Uid', revision: 4 })
    ).toEqual({ identityId: 'Uid', revision: 4 });
    expect(() => parseProfileUpdateReceipt({ success: true })).toThrow();
  });
});
