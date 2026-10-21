import {
  discussionSelectionQuery,
  parseDiscussionSelection,
} from './discussion-selection';

const id = '10000000-0000-4000-8000-000000000001';
const app = '10000000-0000-4000-8000-000000000002';
const item = {
  id,
  applicationId: app,
  revision: 2,
  title: 'A real topic',
  replyCount: 3,
};

describe('public discussion selection contract', () => {
  it('accepts bounded exact IDs and current public details or explicit absence', () => {
    expect(discussionSelectionQuery({ ids: `${id},${app}` })).toEqual([
      id,
      app,
    ]);
    expect(parseDiscussionSelection({ items: [item] }, [id])).toEqual({
      items: [item],
    });
    expect(parseDiscussionSelection({ items: [] }, [id])).toEqual({
      items: [],
    });
  });
  it.each([
    {},
    { ids: '' },
    { ids: 'slug' },
    { ids: [id] },
    { ids: `${id},${id}` },
    { ids: id, tenantId: 'private' },
    { ids: Array(51).fill(id).join(',') },
  ])('rejects ambiguous or unbounded selection %j', (query) => {
    expect(() => discussionSelectionQuery(query)).toThrow();
  });
  it('rejects unrequested/duplicate identities, private fields and fabricated metadata', () => {
    for (const items of [
      [item, item],
      [{ ...item, id: app }],
      [{ ...item, ownerIdentityId: 'private' }],
      [{ ...item, applicationId: 'slug' }],
      [{ ...item, revision: 0 }],
      [{ ...item, title: '' }],
      [{ ...item, title: ' padded ' }],
      [{ ...item, title: 'line\nbreak' }],
      [{ ...item, replyCount: 2000 }],
      [{ ...item, replyCount: 0.5 }],
    ])
      expect(() => parseDiscussionSelection({ items }, [id])).toThrow();
  });
});
