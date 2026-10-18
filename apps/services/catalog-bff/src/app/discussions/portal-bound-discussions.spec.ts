import {
  applicationBoundPage,
  applicationBoundParticipation,
  applicationBoundSelection,
  applicationBoundThread,
  articleBoundThread,
} from './portal-bound-discussions.contract';

const id = '10000000-0000-4000-8000-000000000001';
const parent = '10000000-0000-4000-8000-000000000002';
const bindingKey = 'application:' + parent;
const content = {
  title: 'A topic',
  tags: ['tools'],
  displayName: 'Alice',
  text: 'Body',
};
const thread = {
  id,
  bindingKey,
  revision: 3,
  replyCount: 0,
  pinned: true,
  canPin: false,
  comments: [
    {
      id,
      parentId: null,
      depth: 0,
      content,
      createdAt: 10,
      updatedAt: null,
      editable: true,
      removable: true,
      votes: { upvotes: 2, downvotes: 1, mine: 1 },
    },
  ],
};

describe('generic owner data mapped to the original portal contracts', () => {
  it('extracts topic metadata from consumer content and preserves canonical controls', () => {
    expect(applicationBoundThread(thread, bindingKey, false)).toEqual({
      id,
      revision: 3,
      replyCount: 0,
      pinned: true,
      canPin: false,
      title: content.title,
      tags: content.tags,
      comments: [
        {
          ...thread.comments[0],
          content: { displayName: 'Alice', text: 'Body' },
        },
      ],
    });
  });
  it('maps the same owner contract to article comments without topic fields', () => {
    const comment = Object.fromEntries(
      Object.entries(thread.comments[0]).filter(([field]) => field !== 'votes')
    );
    const result = articleBoundThread(
      {
        ...thread,
        bindingKey: 'article:' + parent,
        comments: [
          { ...comment, content: { displayName: 'Alice', text: 'Body' } },
        ],
      },
      'article:' + parent,
      false
    );
    expect(result).toEqual({
      id,
      revision: 3,
      replyCount: 0,
      comments: [
        { ...comment, content: { displayName: 'Alice', text: 'Body' } },
      ],
    });
  });
  it.each(['application:' + id, 'article:' + parent, bindingKey.toUpperCase()])(
    'rejects an owner response for another exact binding %s',
    (key) => {
      expect(() =>
        applicationBoundThread(
          { ...thread, bindingKey: key },
          bindingKey,
          false
        )
      ).toThrow();
    }
  );
  it('rejects a response that still uses the retired dedicated owner contract', () => {
    expect(() =>
      applicationBoundThread(
        { ...thread, title: 'Unexpected dedicated metadata' },
        bindingKey,
        false
      )
    ).toThrow();
  });
  it('retains structural redaction without introducing author content', () => {
    const removed = {
      id: parent,
      parentId: id,
      depth: 1,
      content: null,
      createdAt: null,
      updatedAt: null,
      editable: false,
      removable: false,
      votes: null,
    };
    expect(
      applicationBoundThread(
        { ...thread, replyCount: 1, comments: [thread.comments[0], removed] },
        bindingKey,
        false
      ).comments[1]
    ).toEqual(removed);
  });
  it('maps discovery and rejects foreign-family metadata', () => {
    expect(applicationBoundSelection({ items: [thread] }, [id])).toEqual({
      items: [
        {
          id,
          applicationId: parent,
          revision: 3,
          title: 'A topic',
          replyCount: 0,
        },
      ],
    });
    expect(
      applicationBoundParticipation({
        items: [{ thread, at: 10, participation: 'author' }],
        next: null,
      })
    ).toEqual({
      items: [
        {
          id,
          applicationId: parent,
          title: 'A topic',
          createdAt: 10,
          replyCount: 0,
          participation: 'author',
        },
      ],
      next: null,
    });
    expect(() =>
      applicationBoundSelection(
        { items: [{ ...thread, bindingKey: 'article:' + parent }] },
        [id]
      )
    ).toThrow();
  });
  it('rejects mixed-binding pages and invented pagination', () => {
    expect(() =>
      applicationBoundPage(
        {
          items: [thread, { ...thread, bindingKey: 'application:' + id }],
          next: null,
        },
        bindingKey
      )
    ).toThrow();
    expect(() =>
      applicationBoundPage({ items: [thread], next: `1.10.${id}` }, bindingKey)
    ).toThrow();
  });
});
