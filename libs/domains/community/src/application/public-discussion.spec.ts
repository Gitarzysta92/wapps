import {
  discussionTarget,
  publicCommentContent,
  publicDiscussionReply,
} from './public-comment';
import {
  boundDiscussionContent,
  publicDiscussionTopic,
} from './public-discussion';

const id = 'f56428fb-9bc2-4c34-814a-3c558ec92391';
const topic = {
  title: 'A useful topic',
  displayName: 'Public reader',
  text: 'Plain content.',
  tags: ['privacy'],
};
describe('public application discussion payloads', () => {
  it('keeps root title/tags separate from reply content and accepts an explicit application target', () => {
    expect(discussionTarget({ kind: 'application', id })).toEqual({
      kind: 'application',
      id,
    });
    expect(
      publicDiscussionTopic({
        ...topic,
        title: ' A useful topic ',
        tags: [' Privacy '],
      })
    ).toEqual(topic);
    expect(
      boundDiscussionContent({ kind: 'application', id }, 'discussion', topic)
    ).toEqual(topic);
    expect(() =>
      boundDiscussionContent({ kind: 'application', id }, 'comment', topic)
    ).toThrow();
  });
  it('allows 5000-character application posts without widening article comment limits', () => {
    const content = { displayName: 'Public reader', text: 'x'.repeat(5000) };
    expect(publicDiscussionReply(content)).toEqual(content);
    expect(publicDiscussionTopic({ ...topic, ...content }).text).toHaveLength(
      5000
    );
    expect(() => publicCommentContent(content)).toThrow();
    expect(() =>
      publicDiscussionReply({ ...content, text: content.text + 'x' })
    ).toThrow();
  });
  it.each([
    { ...topic, title: '' },
    { ...topic, title: 'x'.repeat(121) },
    { ...topic, title: 'Two\nlines' },
    { ...topic, tags: ['Same', 'same'] },
    { ...topic, tags: [''] },
    { ...topic, tags: ['a\nb'] },
    { ...topic, tags: ['x'.repeat(41)] },
    { ...topic, tags: Array.from({ length: 9 }, (_, i) => String(i)) },
    { ...topic, ownerIdentityId: 'forged' },
    { ...topic, applicationId: id },
    { ...topic, pinned: true },
    { ...topic, tags: 'one' },
  ])('refuses malformed, oversized or authority fields %#', (value) => {
    expect(() => publicDiscussionTopic(value)).toThrow();
  });
});
