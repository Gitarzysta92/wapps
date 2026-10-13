import { assertEditorialReviewActor } from './editorial-audit-erasure-schema';

describe('Editorial anonymous review authority', () => {
  const review = {
    actor: 'staff',
    owner: 'author',
    reviewedAt: 100,
    decided: true,
    erasedAt: null,
  };
  it('preserves a real independent review and permits explicit anonymous attribution', () => {
    expect(() => assertEditorialReviewActor(review, false)).not.toThrow();
    expect(() =>
      assertEditorialReviewActor(
        { ...review, actor: null, erasedAt: 110 },
        true
      )
    ).not.toThrow();
  });
  it.each([
    { ...review, actor: null },
    { ...review, actor: null, erasedAt: 99 },
    { ...review, actor: null, erasedAt: -1 },
    { ...review, actor: null, erasedAt: 110, reviewedAt: null },
    { ...review, actor: 'author' },
    { ...review, actor: '' },
    { ...review, owner: '' },
    { ...review, reviewedAt: null },
    { ...review, reviewedAt: 0 },
    { ...review, reviewedAt: NaN },
    { ...review, reviewedAt: 1.5 },
    { ...review, reviewedAt: Number.MAX_SAFE_INTEGER + 1 },
    { ...review, erasedAt: 110 },
    { ...review, actor: null, erasedAt: 110, decided: false },
    { ...review, decided: false },
    { ...review, actor: null, erasedAt: 110, self: true },
  ])('rejects missing or inconsistent reviewer authority: %j', (input) => {
    expect(() => assertEditorialReviewActor(input, true)).toThrow();
  });
  it('does not reinterpret missing legacy identities as erasure', () => {
    expect(() =>
      assertEditorialReviewActor(
        { ...review, actor: null, erasedAt: 110 },
        false
      )
    ).toThrow();
  });
  it('permits an undecided submission and real claimant release', () => {
    expect(() =>
      assertEditorialReviewActor(
        { ...review, actor: null, decided: false },
        true
      )
    ).not.toThrow();
    expect(() =>
      assertEditorialReviewActor(
        { ...review, actor: null, reviewedAt: null, decided: false },
        true
      )
    ).not.toThrow();
    expect(() =>
      assertEditorialReviewActor(
        { ...review, actor: 'author', self: true },
        true
      )
    ).not.toThrow();
  });
});
