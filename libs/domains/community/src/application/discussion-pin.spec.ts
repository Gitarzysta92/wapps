import {
  applicationDiscussionCursor,
  discussionPinChange,
} from './discussion-pin';

const id = '10000000-0000-4000-8000-000000000001';
describe('application discussion pin contracts', () => {
  it.each([true, false])(
    'accepts desired pin %s with an exact revision',
    (pinned) => {
      expect(discussionPinChange({ pinned, expectedRevision: 3 })).toEqual({
        pinned,
        expectedRevision: 3,
      });
    }
  );
  it.each([
    { pinned: 1, expectedRevision: 1 },
    { pinned: true, expectedRevision: 0 },
    { pinned: true, expectedRevision: 1.5 },
    { pinned: true, expectedRevision: 1, actorIdentityId: 'other' },
    { pinned: true, expectedRevision: 1, tenantId: 'other' },
  ])('rejects invalid and injected commands %j', (input) => {
    expect(() => discussionPinChange(input)).toThrow();
  });
  it('binds keyset positions to the pin group, immutable creation time and canonical ID', () => {
    expect(applicationDiscussionCursor(`1.123.${id}`)).toEqual({
      pinned: true,
      at: 123,
      id,
    });
    expect(applicationDiscussionCursor(`0.0.${id}`)).toEqual({
      pinned: false,
      at: 0,
      id,
    });
    for (const cursor of [
      `123.${id}`,
      `2.123.${id}`,
      `1.9007199254740992.${id}`,
      `1.0.${id}.extra`,
      '1.0.not-a-uuid',
    ])
      expect(() => applicationDiscussionCursor(cursor)).toThrow();
  });
});
