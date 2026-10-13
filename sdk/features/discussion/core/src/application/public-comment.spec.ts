import {
  discussionTarget,
  publicCommentContent,
  publicCommentId,
} from './public-comment';

const id = 'f56428fb-9bc2-4c34-814a-3c558ec92391';
describe('public comments', () => {
  it('keeps plain text and an explicitly chosen public name', () => {
    expect(
      publicCommentContent({
        displayName: ' Reader ',
        text: ' <b>plain text</b>\nSecond line ',
      })
    ).toEqual({
      displayName: 'Reader',
      text: '<b>plain text</b>\nSecond line',
    });
  });
  it.each([
    null,
    [],
    {},
    { text: 'body' },
    { displayName: 'name' },
    { displayName: 'name', text: ' ' },
    { displayName: ' ', text: 'body' },
    { displayName: 'name\nother', text: 'body' },
    { displayName: 'name', text: '\0body' },
    { displayName: 'x'.repeat(81), text: 'body' },
    { displayName: 'name', text: 'x'.repeat(4001) },
    { displayName: 'name', text: 'body', ownerIdentityId: 'forged' },
  ])(
    'refuses missing, oversized, ambiguous or authority fields %#',
    (input) => {
      expect(() => publicCommentContent(input)).toThrow();
    }
  );
  it('binds only a canonical article UUID', () => {
    expect(discussionTarget({ kind: 'article', id })).toEqual({
      kind: 'article',
      id,
    });
    expect(() => discussionTarget({ kind: 'suite', id })).toThrow();
    expect(() =>
      discussionTarget({ kind: 'article', id, tenantId: 'forged' })
    ).toThrow();
  });
  it.each([
    undefined,
    '',
    id.toUpperCase(),
    `/${id}`,
    '00000000-0000-0000-0000-000000000000',
  ])('refuses invalid canonical identity %j', (value) => {
    expect(() => publicCommentId(value)).toThrow();
  });
});
