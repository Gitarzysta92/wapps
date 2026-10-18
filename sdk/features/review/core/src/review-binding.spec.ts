import { memberReview, reviewPage } from './review-response';
import { reviewBindingKey, ReviewInputError } from './review';

const key = 'Vendor:Device/preview-42';
const review = {
  id: '00000000-0000-4000-8000-000000000001',
  bindingKey: key,
  revision: 3,
  contentRevision: 2,
  withdrawn: false,
  hidden: false,
  moderationReason: null,
  content: { displayName: 'Member', rating: 4, text: 'Useful.' },
  createdAt: 100,
  updatedAt: 200,
  helpfulCount: 0,
  helpful: false,
  reported: false,
  mine: false,
  canModerate: false,
  openReports: null,
};
it('reads a previously unknown consumer key without interpreting its namespace or version', () => {
  expect(memberReview(review, key)).toEqual(review);
  expect(
    reviewPage(
      {
        items: [review],
        mine: null,
        next: null,
        canModerate: false,
        summary: { total: 1, average: 4, distribution: [0, 0, 0, 1, 0] },
      },
      key
    ).items
  ).toEqual([review]);
});
it('compares exact case-sensitive keys and rejects foreign bindings', () => {
  for (const other of [key.toLowerCase(), 'Vendor:Device/preview-43', 'Other'])
    expect(() => memberReview(review, other)).toThrow(ReviewInputError);
});
it.each(['', 'contains space', 'newline\n', '\u0000', 'x'.repeat(257)])(
  'rejects an invalid binding %j',
  (key) => {
    expect(() => reviewBindingKey(key)).toThrow(ReviewInputError);
  }
);
