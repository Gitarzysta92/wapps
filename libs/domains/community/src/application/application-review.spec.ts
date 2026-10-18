import { memberReview, reviewPage } from './application-review';

const applicationId = '00000000-0000-4000-8000-000000000002';
const review = {
  id: '00000000-0000-4000-8000-000000000001',
  applicationId,
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
it('preserves the original application review HTTP contract', () => {
  expect(memberReview(review, applicationId)).toEqual(review);
  const page = {
    items: [review],
    mine: null,
    next: null,
    canModerate: false,
    summary: { total: 1, average: 4, distribution: [0, 0, 0, 1, 0] },
  };
  expect(reviewPage(page, applicationId)).toEqual(page);
});
it('rejects foreign application IDs and injected engine binding fields', () => {
  expect(() => memberReview(review, review.id)).toThrow();
  expect(() =>
    memberReview({ ...review, bindingKey: applicationId }, applicationId)
  ).toThrow();
  expect(() =>
    memberReview({ ...review, applicationId: 'foreign' }, 'foreign')
  ).toThrow();
});
