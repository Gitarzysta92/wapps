import {
  replyInboxCursor,
  replyInboxPage,
  replyNotificationEvent,
  replyNotificationLease,
} from './reply-notification';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const event = {
  id: id(2),
  discussionId: id(1),
  parentId: id(1),
  recipientId: 'Owner',
  revision: 2,
  at: 100,
};
const item = {
  id: id(2),
  discussionId: id(1),
  target: { kind: 'application', id: id(3) },
  title: 'Application',
  slug: 'application',
  at: 100,
  readAt: null,
};

describe('reply notification contracts', () => {
  it('preserves a reference-only event and distinguishes revisions from representable dates', () => {
    expect(replyNotificationEvent(event)).toEqual(event);
    expect(
      replyNotificationEvent({ ...event, revision: Number.MAX_SAFE_INTEGER })
        .revision
    ).toBe(Number.MAX_SAFE_INTEGER);
    expect(() =>
      replyNotificationEvent({ ...event, at: Number.MAX_SAFE_INTEGER })
    ).toThrow();
  });
  it.each([
    { recipientId: ' Owner' },
    { recipientId: '' },
    { recipientId: 'owner\u0000' },
    { parentId: id(2) },
    { discussionId: id(2) },
    { id: 'invalid' },
    { revision: 1 },
    { at: -1 },
    { at: 1.5 },
    { text: 'private copy' },
  ])(
    'rejects malformed identity, relation, revision, time and extra payload: %j',
    (change) => {
      expect(() => replyNotificationEvent({ ...event, ...change })).toThrow();
    }
  );
  it('requires a real lease token, event and expiration', () => {
    expect(replyNotificationLease({ event, token: id(4), until: 200 })).toEqual(
      { event, token: id(4), until: 200 }
    );
    expect(() =>
      replyNotificationLease({ event, token: id(4), until: 0 })
    ).toThrow();
    expect(() =>
      replyNotificationLease({ token: id(4), until: 200 })
    ).toThrow();
  });
  it.each([
    '01.' + id(1),
    '1.0.' + id(1),
    '-1.' + id(1),
    '8640000000000001.' + id(1),
    '1.invalid',
  ])('rejects noncanonical cursor %s', (cursor) => {
    expect(() => replyInboxCursor(cursor)).toThrow();
  });
  it('validates inbox read times, unique bounded pages and disabled state', () => {
    expect(
      replyInboxPage({ enabled: true, items: [item], next: null }).items
    ).toEqual([item]);
    for (const page of [
      { enabled: true, items: [item] },
      { enabled: false, items: [item], next: null },
      { enabled: true, items: [item, item], next: null },
      { enabled: true, items: [{ ...item, readAt: 99 }], next: null },
      {
        enabled: true,
        items: [{ ...item, target: { kind: 'private', id: id(3) } }],
        next: null,
      },
    ])
      expect(() => replyInboxPage(page)).toThrow();
  });
});
