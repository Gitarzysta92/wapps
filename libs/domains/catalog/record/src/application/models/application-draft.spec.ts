import {
  applicationDraftId,
  applicationDraftRevision,
  parseApplicationDraftFields,
  parseApplicationDraft,
  parseApplicationDraftList,
  parseApplicationDraftReceipt,
  parseApplicationEditingTarget,
  parseApplicationEditingSource,
} from './application-draft';

const id = '019a0010-0000-7000-8000-000000000001';
const fields = {
  name: 'Example',
  slug: 'example',
  website: 'https://example.test',
  description: 'An application with enough detail.',
};
const draft = { ...fields, id, revision: 1, createdAt: 10, updatedAt: 20 };

describe('application draft contracts', () => {
  it('preserves proposed classification and leaves legacy drafts unclassified', () => {
    expect(parseApplicationDraft(draft).classification).toBeUndefined();
    for (const classification of ['general', 'mature'])
      expect(
        parseApplicationDraft({ ...draft, classification }).classification
      ).toBe(classification);
    for (const classification of [null, '', 'safe', true])
      expect(() =>
        parseApplicationDraftFields({ ...fields, classification })
      ).toThrow();
  });
  it('normalizes bounded input without accepting ownership or public state', () => {
    expect(
      parseApplicationDraftFields({ ...fields, name: ' Example ' })
    ).toEqual(fields);
    for (const extra of [
      'id',
      'ownerIdentityId',
      'tenantId',
      'visibility',
      'revision',
      'verified',
    ])
      expect(() =>
        parseApplicationDraftFields({ ...fields, [extra]: 'injected' })
      ).toThrow();
  });
  it.each([
    { name: 'x' },
    { name: 'x'.repeat(101) },
    { name: 'Example\u0000' },
    { slug: 'Example' },
    { slug: 'two--hyphens' },
    { slug: '-edge' },
    { slug: 'x'.repeat(81) },
    { website: 'javascript:alert(1)' },
    { website: 'https://user:password@example.test' },
    { website: 'https://example.test/a b' },
    { website: '/relative' },
    { website: 'https://example.test/' + 'x'.repeat(2048) },
    { description: 'Too short' },
    { description: 'x'.repeat(2001) },
  ])('rejects invalid draft fields: %j', (invalid) => {
    expect(() =>
      parseApplicationDraftFields({ ...fields, ...invalid })
    ).toThrow();
  });
  it('allows multiline descriptions and URLs longer than the public record limit', () => {
    const value = {
      ...fields,
      website: 'https://example.test/' + 'x'.repeat(600),
      description: 'First descriptive line.\nSecond descriptive line.',
    };
    expect(parseApplicationDraftFields(value)).toEqual(value);
  });
  it.each([0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1, null])(
    'rejects invalid revision %p',
    (revision) => {
      expect(() => applicationDraftRevision(revision)).toThrow();
    }
  );
  it.each([
    '../other',
    id.toUpperCase(),
    '00000000-0000-0000-0000-000000000000',
    null,
  ])('rejects unsafe identities %p', (value) => {
    expect(() => applicationDraftId(value)).toThrow();
  });
  it('validates complete snapshots, time ordering and duplicate list entries', () => {
    expect(parseApplicationDraft(draft)).toEqual(draft);
    expect(() => parseApplicationDraft({ ...draft, updatedAt: 1 })).toThrow();
    expect(() =>
      parseApplicationDraft({ ...draft, updatedAt: 8_640_000_000_000_001 })
    ).toThrow();
    expect(() =>
      parseApplicationDraft({ ...draft, website: undefined })
    ).toThrow();
    expect(() => parseApplicationDraftList([draft, draft])).toThrow();
    expect(() =>
      parseApplicationDraftList([
        draft,
        { ...draft, id: '019a0010-0000-7000-8000-000000000002' },
      ])
    ).toThrow();
    expect(() => parseApplicationDraftList(Array(101).fill(draft))).toThrow();
    expect(parseApplicationDraftList([])).toEqual([]);
  });
  it('requires an exact receipt with a boolean tombstone flag', () => {
    expect(
      parseApplicationDraftReceipt({ id, revision: 2, deleted: true })
    ).toEqual({ id, revision: 2, deleted: true });
    expect(() =>
      parseApplicationDraftReceipt({ id, revision: 2, deleted: 1 })
    ).toThrow();
    expect(() =>
      parseApplicationDraftReceipt({
        id,
        revision: 2,
        deleted: false,
        extra: true,
      })
    ).toThrow();
  });
  it('keeps canonical editing identity and revision distinct from the private draft revision', () => {
    const editing = {
      applicationId: '019a0010-0000-7000-8000-000000000002',
      claimId: '019a0010-0000-7000-8000-000000000003',
      sourcePublicationRevision: 42,
    };
    expect(parseApplicationDraft({ ...draft, editing })).toEqual({
      ...draft,
      editing,
    });
    expect(() =>
      parseApplicationEditingTarget({
        ...editing,
        sourcePublicationRevision: 0,
      })
    ).toThrow();
    expect(() =>
      parseApplicationEditingTarget({ ...editing, claimId: 'other' })
    ).toThrow();
    expect(() =>
      parseApplicationEditingTarget({ ...editing, verified: true })
    ).toThrow();
    expect(() =>
      parseApplicationDraft({ ...draft, editing: { applicationId: id } })
    ).toThrow();
  });
  it('reads incomplete canonical content for explicit repair without allowing it as a saved draft', () => {
    const value = {
      applicationId: id,
      claimId: id,
      sourcePublicationRevision: 3,
      fields: { name: 'Legacy', slug: 'legacy', website: '', description: '' },
    };
    expect(parseApplicationEditingSource(value)).toEqual(value);
    expect(() => parseApplicationDraftFields(value.fields)).toThrow();
    expect(() =>
      parseApplicationEditingSource({
        ...value,
        fields: { ...value.fields, description: 'x'.repeat(65537) },
      })
    ).toThrow();
    expect(() =>
      parseApplicationEditingSource({ ...value, tenantId: 'other' })
    ).toThrow();
  });
});
