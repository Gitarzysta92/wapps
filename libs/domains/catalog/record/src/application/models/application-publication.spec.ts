import {
  assertApplicationPublicationTransition,
  parseApplicationPublicationInput,
  parseApplicationPublicationReceipt,
  parseApplicationPublicationStatus,
  parseApplicationReviewPage,
  parseApplicationSubmission,
  type ApplicationPublicationStatus,
  type ApplicationSubmission,
} from './application-publication';

const submission: ApplicationSubmission = {
  name: 'Example',
  slug: 'example',
  website: 'https://example.test',
  description: 'An application with enough detail.',
  submittedRevision: 1,
  basePublicationRevision: null,
  status: 'submitted',
  submittedAt: 10,
  reviewedAt: null,
  reason: '',
};
const pending: ApplicationPublicationStatus = {
  id: '019a0010-0000-7000-8000-000000000001',
  revision: 2,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  publicSlug: null,
  latestSubmission: submission,
};
describe('application submission and publication invariants', () => {
  it('requires resubmission of legacy unknown images without withdrawing existing publication', () => {
    const legacy = {
      ...pending,
      publicSlug: 'example',
      publicationRevision: 1,
      publishedSubmissionRevision: 1,
      latestSubmission: {
        ...submission,
        images: null,
        basePublicationRevision: 1,
      },
    };
    expect(() =>
      assertApplicationPublicationTransition('approve', legacy, {
        expectedRevision: 2,
        submittedRevision: 1,
        reason: '',
      })
    ).toThrow('image');
    expect(() =>
      assertApplicationPublicationTransition('submit', legacy, {
        expectedRevision: 2,
        submittedRevision: null,
        reason: '',
      })
    ).not.toThrow();
    expect(
      parseApplicationSubmission({ ...submission, images: null }).images
    ).toBeNull();
    expect(
      parseApplicationSubmission({
        ...submission,
        images: { logo: null, banner: null },
      }).images
    ).toEqual({ logo: null, banner: null });
  });
  it('accepts approval of frozen content after private edits with the new aggregate revision', () => {
    expect(() =>
      assertApplicationPublicationTransition(
        'approve',
        { ...pending, revision: 3 },
        { expectedRevision: 3, submittedRevision: 1, reason: '' }
      )
    ).not.toThrow();
  });
  it('rejects a stale draft revision, wrong submission or already-decided review', () => {
    for (const input of [
      { expectedRevision: 1, submittedRevision: 1, reason: '' },
      { expectedRevision: 2, submittedRevision: 2, reason: '' },
    ])
      expect(() =>
        assertApplicationPublicationTransition('approve', pending, input)
      ).toThrow();
    expect(() =>
      assertApplicationPublicationTransition(
        'approve',
        {
          ...pending,
          latestSubmission: {
            ...submission,
            status: 'rejected',
            reason: 'Incomplete',
            reviewedAt: 20,
          },
        },
        { expectedRevision: 2, submittedRevision: 1, reason: '' }
      )
    ).toThrow();
  });
  it('refuses approval over an independently changed public revision but still permits rejection', () => {
    const changed = {
      ...pending,
      publicationRevision: 5,
      latestSubmission: { ...submission, basePublicationRevision: 4 },
    };
    const input = {
      expectedRevision: 2,
      submittedRevision: 1,
      reason: 'Public content changed',
    };
    expect(() =>
      assertApplicationPublicationTransition('approve', changed, input)
    ).toThrow('public application changed');
    expect(() =>
      assertApplicationPublicationTransition('reject', changed, input)
    ).not.toThrow();
  });
  it('prevents a second pending submission and empty withdrawal', () => {
    expect(() =>
      assertApplicationPublicationTransition('submit', pending, {
        expectedRevision: 2,
        submittedRevision: null,
        reason: '',
      })
    ).toThrow('already awaiting');
    expect(() =>
      assertApplicationPublicationTransition(
        'withdraw',
        { ...pending, latestSubmission: null },
        { expectedRevision: 2, submittedRevision: null, reason: '' }
      )
    ).toThrow();
  });
  it('requires rejection reasons and rejects protected fields in owner commands', () => {
    expect(() =>
      parseApplicationPublicationInput('reject', {
        expectedRevision: 2,
        submittedRevision: 1,
        reason: ' ',
      })
    ).toThrow();
    expect(() =>
      parseApplicationPublicationInput('submit', {
        expectedRevision: 1,
        visibility: 'public',
      })
    ).toThrow();
    expect(
      parseApplicationPublicationInput('reject', {
        expectedRevision: 2,
        submittedRevision: 1,
        reason: ' Explain ',
      }).reason
    ).toBe('Explain');
  });
  it('validates immutable submission fields and lifecycle timestamps', () => {
    expect(parseApplicationSubmission(submission)).toEqual(submission);
    expect(() =>
      parseApplicationSubmission({ ...submission, status: 'approved' })
    ).toThrow();
    expect(() =>
      parseApplicationSubmission({
        ...submission,
        status: 'approved',
        reviewedAt: 1,
      })
    ).toThrow();
    expect(() =>
      parseApplicationSubmission({ ...submission, ownerIdentityId: 'injected' })
    ).toThrow();
  });
  it('does not mislabel directly modified public content as the approved submission', () => {
    expect(
      parseApplicationPublicationStatus({
        ...pending,
        publicSlug: 'changed-by-editorial',
        publicationRevision: 4,
      })
    ).toMatchObject({
      publishedSubmissionRevision: null,
      publicSlug: 'changed-by-editorial',
    });
    expect(() =>
      parseApplicationPublicationStatus({ ...pending, publicSlug: 'example' })
    ).toThrow();
    expect(() =>
      parseApplicationPublicationStatus({
        ...pending,
        publishedSubmissionRevision: 1,
      })
    ).toThrow();
  });
  it('bounds the review queue and rejects duplicate or completed entries', () => {
    expect(
      parseApplicationReviewPage({ items: [pending], page: 1, total: 1 }).items
    ).toEqual([pending]);
    expect(() =>
      parseApplicationReviewPage({
        items: [pending, pending],
        page: 1,
        total: 2,
      })
    ).toThrow();
    expect(() =>
      parseApplicationReviewPage({ items: [], page: 10001, total: 0 })
    ).toThrow();
  });
  it('rejects impossible receipts instead of confirming an invalid publication', () => {
    const receipt = {
      id: pending.id,
      revision: 3,
      action: 'approve',
      submittedRevision: 1,
      publicationRevision: 1,
    };
    expect(parseApplicationPublicationReceipt(receipt)).toEqual(receipt);
    for (const change of [
      { revision: 1 },
      { submittedRevision: null },
      { submittedRevision: 3 },
      { publicationRevision: null },
      { action: 'submit' },
    ])
      expect(() =>
        parseApplicationPublicationReceipt({ ...receipt, ...change })
      ).toThrow();
    expect(
      parseApplicationPublicationReceipt({
        ...receipt,
        action: 'withdraw',
        submittedRevision: null,
        publicationRevision: null,
      }).action
    ).toBe('withdraw');
  });
});
