import { discussionVoteChange, discussionVoteState } from './discussion-vote';

describe('discussion vote contracts', () => {
  it.each([-1, 0, 1])(
    'accepts desired vote %s with an exact thread revision',
    (value) => {
      expect(discussionVoteChange({ value, expectedRevision: 3 })).toEqual({
        value,
        expectedRevision: 3,
      });
    }
  );
  it.each([
    { value: 2, expectedRevision: 1 },
    { value: '1', expectedRevision: 1 },
    { value: 1, expectedRevision: 0 },
    { value: 1, expectedRevision: 1.5 },
    { value: 1, expectedRevision: 1, actorIdentityId: 'other' },
    { value: 1, expectedRevision: 1, tenantId: 'other' },
  ])('rejects invalid or injected vote commands %j', (value) => {
    expect(() => discussionVoteChange(value)).toThrow();
  });
  it('validates canonical counts and own membership without exposing voter identities', () => {
    expect(discussionVoteState({ upvotes: 3, downvotes: 2, mine: -1 })).toEqual(
      { upvotes: 3, downvotes: 2, mine: -1 }
    );
    for (const value of [
      { upvotes: -1, downvotes: 0, mine: 0 },
      { upvotes: 0, downvotes: 0, mine: 1 },
      { upvotes: 0, downvotes: 0, mine: -1 },
      { upvotes: 1, downvotes: 0, mine: 2 },
      { upvotes: 1, downvotes: 0, mine: 0, identities: ['private'] },
    ])
      expect(() => discussionVoteState(value)).toThrow();
  });
});
