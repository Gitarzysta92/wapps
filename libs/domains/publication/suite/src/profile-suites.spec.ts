import {
  parseProfileSuitesPage,
  parseProfileSuitesQuery,
  profileSuitesPage,
} from './profile-suites';

const item = (index: number) => ({
  id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  title: 'Public title',
  description: 'Reviewed description',
});
describe('public profile suites contract', () => {
  it('pages only ordered public summaries and continues from a returned UUID', () => {
    const page = profileSuitesPage(
      Array.from({ length: 21 }, (_, index) => item(index)),
      null
    );
    expect(page.items).toHaveLength(20);
    expect(page.after).toBe(item(19).id);
    expect(profileSuitesPage([item(20)], page.after)).toEqual({
      sharing: 'visible',
      items: [item(20)],
      after: null,
    });
  });
  it('distinguishes hidden from an empty shared collection', () => {
    for (const sharing of ['hidden', 'visible'])
      expect(
        parseProfileSuitesPage({ sharing, items: [], after: null }).sharing
      ).toBe(sharing);
  });
  it.each([
    { sharing: 'hidden', items: [item(1)], after: null },
    {
      sharing: 'visible',
      items: [{ ...item(1), ownerIdentityId: 'PrivateUid' }],
      after: null,
    },
    {
      sharing: 'visible',
      items: [{ ...item(1), applicationIds: [] }],
      after: null,
    },
    { sharing: 'visible', items: [item(1), item(1)], after: null },
    { sharing: 'visible', items: [item(2), item(1)], after: null },
    { sharing: 'visible', items: [item(1)], after: item(1).id },
    {
      sharing: 'visible',
      items: [{ ...item(1), title: 'x'.repeat(101) }],
      after: null,
    },
  ])(
    'rejects private fields, invalid text/order and malformed continuations: %j',
    (value) => {
      expect(() => parseProfileSuitesPage(value)).toThrow();
    }
  );
  it('rejects unknown scope and cursor injection before listing', () => {
    for (const query of [
      { ownerIdentityId: 'PrivateUid' },
      { after: [item(1).id] },
      { after: '' },
      { after: null },
      { after: 'a-slug' },
    ])
      expect(() => parseProfileSuitesQuery(query)).toThrow();
    expect(parseProfileSuitesQuery({})).toEqual({ after: null });
    expect(parseProfileSuitesQuery({ after: item(1).id })).toEqual({
      after: item(1).id,
    });
    expect(() => profileSuitesPage([item(1)], item(1).id)).toThrow();
  });
});
