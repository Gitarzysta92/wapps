import {
  assertReleasePublicationTransition,
  assertReleaseSubmissionDate,
  assertReleaseVersion,
  parsePublishedRelease,
  parseReleaseBrowseFilter,
  parseReleaseDraft,
  parseReleaseFields,
  parseReleasePage,
  parseReleasePublicationInput,
  parseReleasePublicationReceipt,
  parseReleasePublicationStatus,
  parseReleaseReceipt,
  parseReleaseReviewPage,
  parseReleaseSubmission,
  parseReleaseTarget,
  releaseId,
  releaseRevision,
  releaseTimestamp,
  type ReleaseFields,
  type ReleasePublicationStatus,
  type ReleaseSubmission,
} from './release-workspace';

const id = '019a0010-0000-7000-8000-000000000001';
const appId = '019a0010-0000-7000-8000-000000000002';
const claimId = '019a0010-0000-7000-8000-000000000003';
const at = Date.parse('2026-10-12T00:00:00.000Z');
const fields: ReleaseFields = {
  version: '2026.10-rc_1+vendor',
  channel: 'prerelease',
  type: 'minor',
  title: 'Release notes',
  description: 'An independently reviewed update.',
  releasedOn: '2026-10-12',
  changes: [{ type: 'security', description: 'Fix a permission boundary.' }],
};
const target = {
  applicationId: appId,
  releaseId: id,
  claimId,
  sourcePublicationRevision: null,
};
describe('release browsing filters', () => {
  it('checks reviewer application context against the frozen target', () => {
    const application = { id: appId, name: 'Application', slug: 'application' };
    expect(
      parseReleasePublicationStatus({ ...pending, application }).application
    ).toEqual(application);
    expect(() =>
      parseReleasePublicationStatus({
        ...pending,
        application: { ...application, id: claimId },
      })
    ).toThrow();
    expect(() =>
      parseReleasePublicationStatus({
        ...pending,
        application: { ...application, slug: '../other' },
      })
    ).toThrow();
  });
  it('accepts only explicit channels and real earlier-date bounds', () => {
    expect(parseReleaseBrowseFilter({})).toEqual({});
    expect(
      parseReleaseBrowseFilter({ channel: 'stable', before: '2024-02-29' })
    ).toEqual({ channel: 'stable', before: '2024-02-29' });
  });
  it.each([
    { channel: 'private' },
    { channel: ['stable'] },
    { before: '2025-02-29' },
    { before: '0000-01-01' },
    { tenant: 'other' },
  ])('rejects invalid and authority-like filters: %j', (input) => {
    expect(() => parseReleaseBrowseFilter(input)).toThrow();
  });
});
const submission: ReleaseSubmission = {
  ...fields,
  target,
  submittedRevision: 1,
  submittedAt: at,
  reviewedAt: null,
  status: 'submitted',
  reason: '',
};
const pending: ReleasePublicationStatus = {
  id,
  revision: 2,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  publicVersion: null,
  latestSubmission: submission,
};
const approval = {
  expectedRevision: 2,
  expectedPublicationRevision: null,
  submittedRevision: 1,
  reason: '',
};
const published = {
  ...fields,
  id,
  applicationId: appId,
  applicationSlug: 'example',
  applicationName: 'Example',
  revision: 1,
  publishedAt: at,
};

describe('release content and revision contracts', () => {
  it('supports vendor versions and preserves ordered changes while normalizing text', () => {
    const input = {
      ...fields,
      title: '  Release notes  ',
      changes: [
        ...fields.changes,
        { type: 'fix', description: ' Another fix. ' },
      ],
    };
    expect(parseReleaseFields(input)).toEqual({
      ...fields,
      changes: [
        ...fields.changes,
        { type: 'fix', description: 'Another fix.' },
      ],
    });
    expect(input.changes[1].description).toBe(' Another fix. ');
  });
  it.each([
    '',
    '..',
    '../escape',
    '1/2',
    'v 1',
    '1?draft',
    '1#draft',
    '1%2f2',
    'a'.repeat(81),
  ])('rejects unsafe version URL %s', (version) => {
    expect(() => parseReleaseFields({ ...fields, version })).toThrow();
  });
  it.each([
    '2026-02-29',
    '2026-13-01',
    '2026-04-31',
    '2026-1-01',
    '0000-01-01',
    '2026-10-12T00:00:00Z',
  ])('rejects invalid release date %s', (releasedOn) => {
    expect(() => parseReleaseFields({ ...fields, releasedOn })).toThrow();
  });
  it('permits future drafts and leap days but refuses early submission/publication', () => {
    const future = parseReleaseFields({ ...fields, releasedOn: '2028-02-29' });
    expect(() => assertReleaseSubmissionDate(future, at)).toThrow();
    expect(() => assertReleaseSubmissionDate(fields, at)).not.toThrow();
    expect(() => assertReleaseSubmissionDate(fields, at - 1)).toThrow();
    expect(() =>
      parsePublishedRelease({ ...published, releasedOn: future.releasedOn })
    ).toThrow();
  });
  it('bounds each field, changes and the complete serialized payload', () => {
    for (const change of [
      { title: ' ' },
      { title: 'x'.repeat(161) },
      { description: 'x'.repeat(4001) },
      { changes: [] },
      { changes: Array(101).fill(fields.changes[0]) },
      { changes: [{ type: 'fix', description: 'x'.repeat(1001) }] },
      {
        changes: Array(20).fill({ type: 'fix', description: 'x'.repeat(1000) }),
      },
      { title: 'injected\u0000' },
      { changes: [{ type: 'unknown', description: 'Change' }] },
      { channel: 'nightly' },
      { type: 'unknown' },
      { ownerIdentityId: 'forged' },
    ])
      expect(() => parseReleaseFields({ ...fields, ...change })).toThrow();
  });
  it('rejects invalid identity, timestamp and revision primitives', () => {
    for (const value of [0, -1, 1.1, '2', Number.MAX_SAFE_INTEGER, NaN])
      expect(() => releaseRevision(value)).toThrow();
    for (const value of [-1, Infinity, 1.1, '1', 253_402_300_800_000])
      expect(() => releaseTimestamp(value)).toThrow();
    expect(() => releaseId('not-a-uuid')).toThrow();
    expect(() =>
      parseReleaseTarget({ ...target, sourcePublicationRevision: undefined })
    ).toThrow();
    expect(() =>
      parseReleaseTarget({ ...target, tenantId: 'forged' })
    ).toThrow();
  });
  it('validates private drafts and deletion receipts without granting publication', () => {
    const draft = {
      ...fields,
      target,
      id,
      revision: 1,
      createdAt: at,
      updatedAt: at,
    };
    expect(parseReleaseDraft(draft)).toEqual(draft);
    expect(() => parseReleaseDraft({ ...draft, updatedAt: at - 1 })).toThrow();
    expect(() => parseReleaseDraft({ ...draft, published: true })).toThrow();
    expect(parseReleaseReceipt({ id, revision: 2, deleted: true })).toEqual({
      id,
      revision: 2,
      deleted: true,
    });
    expect(() =>
      parseReleaseReceipt({ id, revision: 2, deleted: 1 })
    ).toThrow();
  });
  it('retains the original version after publication, including withdrawn releases', () => {
    expect(() => assertReleaseVersion(fields, null)).not.toThrow();
    expect(() => assertReleaseVersion(fields, fields.version)).not.toThrow();
    expect(() =>
      assertReleaseVersion({ ...fields, version: 'renamed' }, fields.version)
    ).toThrow('cannot be renamed');
  });
});

describe('immutable release review', () => {
  it('permits approval of frozen content after later private edits', () => {
    const before = JSON.stringify(pending);
    expect(() =>
      assertReleasePublicationTransition(
        'approve',
        { ...pending, revision: 7 },
        { ...approval, expectedRevision: 7 }
      )
    ).not.toThrow();
    expect(JSON.stringify(pending)).toBe(before);
  });
  it('requires both the current private and public revisions', () => {
    for (const input of [
      { ...approval, expectedRevision: 1 },
      { ...approval, expectedPublicationRevision: 1 },
    ])
      expect(() =>
        assertReleasePublicationTransition('approve', pending, input)
      ).toThrow('changed');
  });
  it('requires explicit rebase and resubmission after another draft publishes', () => {
    const status = {
      ...pending,
      publicationRevision: 8,
      latestSubmission: {
        ...submission,
        target: { ...target, sourcePublicationRevision: 7 },
      },
    };
    const input = { ...approval, expectedPublicationRevision: 8 };
    expect(() =>
      assertReleasePublicationTransition('approve', status, input)
    ).toThrow('Rebase');
    expect(() =>
      assertReleasePublicationTransition('reject', status, {
        ...input,
        reason: 'Stale release',
      })
    ).not.toThrow();
  });
  it('refuses duplicate pending submission, obsolete decisions and empty withdrawal', () => {
    expect(() =>
      assertReleasePublicationTransition('submit', pending, approval)
    ).toThrow('already awaiting');
    expect(() =>
      assertReleasePublicationTransition('approve', pending, {
        ...approval,
        submittedRevision: 2,
      })
    ).toThrow();
    expect(() =>
      assertReleasePublicationTransition(
        'approve',
        {
          ...pending,
          latestSubmission: {
            ...submission,
            status: 'cancelled',
            reviewedAt: at,
          },
        },
        approval
      )
    ).toThrow();
    expect(() =>
      assertReleasePublicationTransition(
        'withdraw',
        { ...pending, latestSubmission: null },
        approval
      )
    ).toThrow();
    expect(() =>
      assertReleasePublicationTransition('withdraw', pending, approval)
    ).not.toThrow();
  });
  it('rejects authority fields and requires rejection reasons and complete expected revisions', () => {
    expect(parseReleasePublicationInput('approve', approval)).toEqual(approval);
    expect(() => parseReleasePublicationInput('reject', approval)).toThrow();
    expect(() =>
      parseReleasePublicationInput('submit', { expectedRevision: 1 })
    ).toThrow();
    expect(() =>
      parseReleasePublicationInput('submit', {
        expectedRevision: 1,
        expectedPublicationRevision: null,
        reason: 'Approve me',
      })
    ).toThrow();
  });
  it('rejects inconsistent review dates and reasons in every terminal state', () => {
    expect(parseReleaseSubmission(submission)).toEqual(submission);
    for (const change of [
      { reviewedAt: at },
      { status: 'approved' },
      { status: 'rejected', reviewedAt: at },
      { status: 'rejected', reviewedAt: at - 1, reason: 'Incomplete' },
      { reason: 'Unreviewed decision' },
      { status: 'cancelled', reviewedAt: at, reason: 'Forged' },
      { status: 'cancelled', reviewedAt: at, releasedOn: '2027-01-01' },
    ])
      expect(() =>
        parseReleaseSubmission({ ...submission, ...change })
      ).toThrow();
  });
  it('validates status and accepts publication created from a different private draft', () => {
    expect(parseReleasePublicationStatus(pending)).toEqual(pending);
    expect(
      parseReleasePublicationStatus({
        ...pending,
        publicationRevision: 10,
        publicVersion: fields.version,
      }).publishedSubmissionRevision
    ).toBeNull();
    for (const change of [
      { revision: 1 },
      { publishedSubmissionRevision: 1 },
      { publicVersion: fields.version },
    ])
      expect(() =>
        parseReleasePublicationStatus({ ...pending, ...change })
      ).toThrow();
  });
  it('rejects impossible receipts, with separate public and private revision sequences', () => {
    const receipt = {
      id,
      releaseId: id,
      revision: 3,
      action: 'approve',
      submittedRevision: 1,
      publicationRevision: 12,
    };
    expect(parseReleasePublicationReceipt(receipt)).toEqual(receipt);
    for (const change of [
      { revision: 1 },
      { submittedRevision: null },
      { publicationRevision: null },
      { action: 'submit' },
    ])
      expect(() =>
        parseReleasePublicationReceipt({ ...receipt, ...change })
      ).toThrow();
    expect(
      parseReleasePublicationReceipt({
        ...receipt,
        action: 'withdraw',
        submittedRevision: null,
      })
    ).toMatchObject({ action: 'withdraw' });
  });
  it('rejects duplicate, completed and overflowing review pages', () => {
    expect(
      parseReleaseReviewPage({ items: [pending], page: 1, total: 1 }).items
    ).toEqual([pending]);
    for (const page of [
      { items: [pending, pending], page: 1, total: 2 },
      { items: [pending], page: 2, total: 1 },
      { items: [], page: 10001, total: 0 },
      { items: [{ ...pending, latestSubmission: null }], page: 1, total: 1 },
    ])
      expect(() => parseReleaseReviewPage(page)).toThrow();
  });
  it('validates public pages, refusing duplicates and releases of another application', () => {
    expect(
      parseReleasePage({ items: [published], page: 1, total: 1 }).items
    ).toEqual([published]);
    for (const page of [
      { items: [published, published], page: 1, total: 2 },
      { items: [published], page: 2, total: 1 },
      {
        items: [
          published,
          { ...published, id: claimId, applicationId: claimId },
        ],
        page: 1,
        total: 2,
      },
    ])
      expect(() => parseReleasePage(page)).toThrow();
  });
});
