import { discussionKey, DiscussionKeyError } from './discussion-key';

describe('consumer-owned discussion keys', () => {
  it.each([
    'ticket/123',
    'meeting:ABCDE',
    'somebody-else@v927|format/42',
    'A'.repeat(256),
  ])('preserves %s exactly without a type or version registry', (key) => {
    expect(discussionKey(key)).toBe(key);
  });
  it('does not fold case, decode escapes or normalize names', () => {
    expect(discussionKey('A/%2f')).not.toBe(discussionKey('a//'));
  });
  it.each([
    null,
    undefined,
    1,
    {},
    '',
    ' x',
    'x ',
    'x\n',
    'x\u0000',
    'a'.repeat(257),
  ])('rejects malformed or unbounded keys: %j', (key) => {
    expect(() => discussionKey(key)).toThrow(DiscussionKeyError);
  });
});
