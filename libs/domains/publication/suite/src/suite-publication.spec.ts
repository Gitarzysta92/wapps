import {
  assertSuitePublicationTransition,
  parsePublicSuiteQuery,
  parsePublicSuiteSelection,
  parsePublicSuiteSelectionQuery,
  parseSuitePublicationInput,
  parseSuitePublicationStatus,
  parseSuiteSubmission,
  type SuitePublicationStatus,
} from './suite-publication';

const id = '019a0010-0000-7000-8000-000000000001';
const submission = {
  title: 'Reviewed tools',
  description: '',
  applicationIds: [id],
  submittedRevision: 1,
  submittedAt: 100,
  reviewedAt: null,
  reason: '',
  status: 'submitted' as const,
};
const pending: SuitePublicationStatus = {
  id,
  revision: 2,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  latestSubmission: submission,
};

describe('suite publication rules', () => {
  it('preserves the classification on the frozen submission, including legacy absence', () => {
    expect(parseSuiteSubmission(submission).classification).toBeUndefined();
    expect(
      parseSuiteSubmission({ ...submission, classification: 'mature' })
        .classification
    ).toBe('mature');
    expect(() =>
      parseSuiteSubmission({ ...submission, classification: 'safe' })
    ).toThrow();
  });
  it('bounds canonical suite selection and refuses tenant or projection filters', () => {
    expect(parsePublicSuiteSelectionQuery({ ids: `${id},${id}` })).toEqual([
      id,
    ]);
    for (const input of [
      {},
      { ids: '' },
      { ids: 'slug' },
      { ids: [id] },
      { ids: id, tenantId: 'private' },
      { ids: Array(51).fill(id).join(',') },
    ])
      expect(() => parsePublicSuiteSelectionQuery(input)).toThrow();
  });
  it('accepts absent targets but rejects duplicate, unrelated or malformed suite metadata', () => {
    const suite = {
      id,
      revision: 1,
      submittedRevision: 1,
      publishedAt: 100,
      title: 'Approved tools',
      description: '',
      applicationIds: [id],
    };
    expect(parsePublicSuiteSelection({ items: [] }, [id])).toEqual({
      items: [],
    });
    expect(parsePublicSuiteSelection({ items: [suite] }, [id])).toEqual({
      items: [suite],
    });
    for (const response of [
      { items: [suite, suite] },
      { items: [{ ...suite, id: '019a0010-0000-7000-8000-000000000002' }] },
      { items: [{ ...suite, revision: 0 }] },
      { items: [suite], total: 1 },
    ])
      expect(() => parsePublicSuiteSelection(response, [id])).toThrow();
  });
  it('binds approval to the submitted content revision after later draft edits', () => {
    expect(() =>
      assertSuitePublicationTransition(
        'approve',
        { ...pending, revision: 8 },
        { expectedRevision: 8, submittedRevision: 1, reason: '' }
      )
    ).not.toThrow();
    expect(() =>
      assertSuitePublicationTransition(
        'approve',
        { ...pending, revision: 8 },
        { expectedRevision: 8, submittedRevision: 8, reason: '' }
      )
    ).toThrow('no longer');
  });
  it('rejects stale reviews, duplicate submissions and decisions on completed reviews', () => {
    expect(() =>
      assertSuitePublicationTransition('approve', pending, {
        expectedRevision: 1,
        submittedRevision: 1,
        reason: '',
      })
    ).toThrow('changed');
    expect(() =>
      assertSuitePublicationTransition('submit', pending, {
        expectedRevision: 2,
        submittedRevision: null,
        reason: '',
      })
    ).toThrow('awaiting');
    expect(() =>
      assertSuitePublicationTransition(
        'approve',
        {
          ...pending,
          latestSubmission: {
            ...submission,
            status: 'rejected',
            reviewedAt: 101,
            reason: 'Needs detail',
          },
        },
        { expectedRevision: 2, submittedRevision: 1, reason: '' }
      )
    ).toThrow('no longer');
  });
  it('requires a reason for rejection and rejects injected fields', () => {
    expect(() =>
      parseSuitePublicationInput('reject', {
        expectedRevision: 2,
        submittedRevision: 1,
        reason: ' ',
      })
    ).toThrow();
    expect(() =>
      parseSuitePublicationInput('submit', {
        expectedRevision: 2,
        title: 'Unreviewed replacement',
      })
    ).toThrow();
    expect(() =>
      parseSuitePublicationInput('approve', {
        expectedRevision: 2,
        submittedRevision: 1,
        reason: '\u0000',
      })
    ).toThrow();
    expect(
      parseSuitePublicationInput('reject', {
        expectedRevision: 2,
        submittedRevision: 1,
        reason: ' Clarify purpose ',
      }).reason
    ).toBe('Clarify purpose');
  });
  it('allows withdrawal of either pending review or a published version', () => {
    expect(() =>
      assertSuitePublicationTransition('withdraw', pending, {
        expectedRevision: 2,
        submittedRevision: null,
        reason: '',
      })
    ).not.toThrow();
    expect(() =>
      assertSuitePublicationTransition(
        'withdraw',
        { ...pending, latestSubmission: null },
        { expectedRevision: 2, submittedRevision: null, reason: '' }
      )
    ).toThrow();
    expect(() =>
      assertSuitePublicationTransition(
        'withdraw',
        {
          ...pending,
          publicationRevision: 1,
          publishedSubmissionRevision: 1,
          latestSubmission: null,
        },
        { expectedRevision: 2, submittedRevision: null, reason: '' }
      )
    ).not.toThrow();
  });
  it('rejects invalid timestamps, status and revision relationships', () => {
    expect(() =>
      parseSuiteSubmission({
        ...submission,
        reviewedAt: 99,
        status: 'approved',
      })
    ).toThrow();
    expect(() =>
      parseSuiteSubmission({ ...submission, status: 'approved' })
    ).toThrow();
    expect(() =>
      parseSuitePublicationStatus({ ...pending, revision: 1 })
    ).toThrow();
    expect(() =>
      parseSuitePublicationStatus({
        ...pending,
        publishedSubmissionRevision: 1,
      })
    ).toThrow();
  });
  it('bounds and validates public query input', () => {
    expect(parsePublicSuiteQuery({ q: ' tools ', page: '2' })).toEqual({
      q: 'tools',
      page: 2,
    });
    for (const query of [
      { q: ['tools'] },
      { page: '0' },
      { page: '10001' },
      { page: '1.2' },
      { owner: id },
      { q: 'x'.repeat(101) },
    ])
      expect(() => parsePublicSuiteQuery(query)).toThrow();
  });
});
