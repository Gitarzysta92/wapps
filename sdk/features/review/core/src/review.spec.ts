import {
  changeReview,
  reviewChange,
  reviewContent,
  reviewCursor,
  reviewSummary,
  ReviewConflictError,
  ReviewInputError,
  ReviewMissingError,
  reviewVisible,
} from './review';

const content = {
  displayName: 'Member',
  rating: 4,
  text: 'Useful application.',
};
const initial = () =>
  changeReview(null, { type: 'publish', content, expectedRevision: 0 });

describe('Review lifecycle', () => {
  it('publishes an immutable content revision, changes it only when authoring', () => {
    const first = initial();
    const helpful = changeReview(first, {
      type: 'helpful',
      helpful: true,
      expectedRevision: 1,
    });
    expect(helpful).toEqual({ ...first, revision: 2 });
    expect(
      changeReview(helpful, { type: 'publish', content, expectedRevision: 2 })
    ).toEqual({ ...first, revision: 3, contentRevision: 3 });
  });
  it('does not let edits or republishing escape a staff hide', () => {
    const hidden = changeReview(initial(), {
      type: 'moderate',
      hidden: true,
      reason: 'Spam',
      expectedRevision: 1,
    });
    const withdrawn = changeReview(hidden, {
      type: 'withdraw',
      expectedRevision: 2,
    });
    const edited = changeReview(withdrawn, {
      type: 'publish',
      content,
      expectedRevision: 3,
    });
    expect(reviewVisible(edited)).toBe(false);
    expect(edited.moderationReason).toBe('Spam');
    expect(edited.withdrawn).toBe(false);
    expect(
      reviewVisible(
        changeReview(edited, {
          type: 'moderate',
          hidden: false,
          reason: 'Resolved',
          expectedRevision: 4,
        })
      )
    ).toBe(true);
  });
  it('staff restoration does not undo author withdrawal', () => {
    const withdrawn = changeReview(initial(), {
      type: 'withdraw',
      expectedRevision: 1,
    });
    expect(
      reviewVisible(
        changeReview(withdrawn, {
          type: 'moderate',
          hidden: false,
          reason: 'Resolved',
          expectedRevision: 2,
        })
      )
    ).toBe(false);
  });
  it('rejects stale commands and revision overflow', () => {
    expect(() =>
      changeReview(initial(), { type: 'withdraw', expectedRevision: 0 })
    ).toThrow(ReviewConflictError);
    expect(() =>
      changeReview(
        { ...initial(), revision: Number.MAX_SAFE_INTEGER },
        { type: 'withdraw', expectedRevision: Number.MAX_SAFE_INTEGER }
      )
    ).toThrow(ReviewConflictError);
  });
  it.each(['helpful', 'report'] as const)(
    'refuses %s against a withdrawn review',
    (type) => {
      const withdrawn = changeReview(initial(), {
        type: 'withdraw',
        expectedRevision: 1,
      });
      expect(() =>
        changeReview(
          withdrawn,
          type === 'helpful'
            ? { type, expectedRevision: 2, helpful: true }
            : { type, expectedRevision: 2, reason: 'Spam' }
        )
      ).toThrow(ReviewMissingError);
    }
  );
});

describe('Review input contracts', () => {
  it.each([0, 6, 3.5, '5', null, NaN])('rejects rating %s', (rating) => {
    expect(() => reviewContent({ ...content, rating })).toThrow(
      ReviewInputError
    );
  });
  it.each([
    { ...content, ownerId: 'forged' },
    { ...content, text: ' ' },
    { ...content, text: 'x'.repeat(6001) },
    { ...content, displayName: 'a\u0000b' },
  ])('rejects malformed content', (value) => {
    expect(() => reviewContent(value)).toThrow(ReviewInputError);
  });
  it('normalizes outer whitespace and preserves plain text', () => {
    expect(
      reviewContent({ ...content, text: ' <script>plain text</script> ' }).text
    ).toBe('<script>plain text</script>');
  });
  it.each(['publish', 'withdraw', 'helpful', 'report', 'moderate'] as const)(
    'rejects unknown %s command fields',
    (type) => {
      expect(() =>
        reviewChange(type, { expectedRevision: 1, ownerId: 'x' })
      ).toThrow(ReviewInputError);
    }
  );
  it('rejects incoherent aggregate data', () => {
    expect(
      reviewSummary({ total: 0, average: null, distribution: [0, 0, 0, 0, 0] })
        .average
    ).toBeNull();
    expect(
      reviewSummary({
        total: 3,
        average: 13 / 3,
        distribution: [0, 0, 0, 2, 1],
      }).total
    ).toBe(3);
    expect(() =>
      reviewSummary({ total: 2, average: 5, distribution: [0, 0, 0, 0, 3] })
    ).toThrow(ReviewInputError);
  });
  it.each([
    '',
    '1.not-an-id',
    '-1.00000000-0000-0000-0000-000000000000',
    '01.00000000-0000-0000-0000-000000000000',
  ])('rejects malformed cursor %s', (cursor) => {
    expect(() => reviewCursor(cursor)).toThrow(ReviewInputError);
  });
});
