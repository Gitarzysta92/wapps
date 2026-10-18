import {
  discussionMentionProfiles,
  discussionMentionRecipients,
  discussionMentionResolution,
} from './discussion-mention';
import { publicCommentContent, publicDiscussionReply } from './public-comment';
import { publicDiscussionTopic } from './public-discussion';

const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';

describe('explicit discussion mentions', () => {
  it('normalizes mentions in every bound payload and preserves the legacy empty shape', () => {
    const content = { displayName: 'Member', text: 'Post' };
    for (const parse of [publicCommentContent, publicDiscussionReply]) {
      expect(parse({ ...content, mentions: [] })).toEqual(content);
      expect(parse({ ...content, mentions: [b, a] })).toEqual({
        ...content,
        mentions: [a, b],
      });
      expect(() => parse({ ...content, mentions: [a, a] })).toThrow();
      expect(() =>
        parse({ ...content, mentions: ['CredentialUid'] })
      ).toThrow();
    }
    expect(
      publicDiscussionTopic({ ...content, title: 'Topic', mentions: [b, a] })
    ).toEqual({ ...content, title: 'Topic', tags: [], mentions: [a, b] });
  });
  it('normalizes public references without credential identities or display names', () => {
    expect(discussionMentionProfiles([b, a])).toEqual([a, b]);
    expect(
      discussionMentionResolution({ authorId: 'Author', profileIds: [a] })
    ).toEqual({ authorId: 'Author', profileIds: [a] });
  });
  it.each(
    [
      undefined,
      null,
      a,
      [a, a],
      ['PrivateCredentialUid'],
      Array(11).fill(a),
    ].map((input) => ({ input }))
  )('rejects invalid or excessive references $input', ({ input }) => {
    expect(() => discussionMentionProfiles(input)).toThrow();
  });
  it('allows an empty resolution or partial eligible subset', () => {
    expect(discussionMentionRecipients([], [a, b])).toEqual([]);
    expect(
      discussionMentionRecipients(
        [{ profileId: a, identityId: 'Recipient' }],
        [a, b]
      )
    ).toEqual([{ profileId: a, identityId: 'Recipient' }]);
  });
  it.each(
    [
      [{ profileId: b, identityId: 'Recipient' }],
      [{ profileId: a, identityId: '' }],
      [{ profileId: a, identityId: 'Recipient', name: 'Untrusted' }],
      [
        { profileId: a, identityId: 'Recipient' },
        { profileId: a, identityId: 'Other' },
      ],
    ].map((rows) => ({ rows }))
  )('rejects out-of-scope or malformed resolution $rows', ({ rows }) => {
    expect(() => discussionMentionRecipients(rows, [a])).toThrow();
  });
  it('rejects multiple public references for the same private recipient', () => {
    expect(() =>
      discussionMentionRecipients(
        [
          { profileId: a, identityId: 'Recipient' },
          { profileId: b, identityId: 'Recipient' },
        ],
        [a, b]
      )
    ).toThrow();
  });
  it('rejects caller-supplied scope or private delivery fields', () => {
    expect(() =>
      discussionMentionResolution({
        authorId: 'Author',
        profileIds: [a],
        tenantId: 'other',
      })
    ).toThrow();
    expect(() =>
      discussionMentionResolution({
        authorId: 'Author',
        identityId: 'Victim',
        profileIds: [a],
      })
    ).toThrow();
  });
});
