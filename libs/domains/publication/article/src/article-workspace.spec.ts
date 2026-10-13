import {
  ARTICLE_LIMITS,
  anonymizeArticleFields,
  ArticleConflictError,
  ArticleInputError,
  articlePreview,
  articleSelectionIds,
  articleSlug,
  assertArticleDeletion,
  assertArticlePublicationTransition,
  assertArticleSlug,
  parseArticleBrowseQuery,
  parseArticleDraft,
  parseArticleFields,
  parseArticlePage,
  parseArticlePublicationInput,
  parseArticlePublicationReceipt,
  parseArticlePublicationStatus,
  parseArticleReviewPage,
  parseArticleSelection,
  parseArticleSubmission,
  parsePublishedArticle,
  type ArticleFields,
  type ArticlePublicationStatus,
} from './article-workspace';

const id = '50000000-0000-4000-8000-000000000001';
const fields: ArticleFields = {
  title: 'Working offline',
  slug: 'working-offline',
  excerpt: 'An explicit summary.',
  byline: 'Alex writes',
  category: 'Guides',
  tags: ['offline'],
  sections: [{ heading: '', paragraphs: ['Actual supplied content.'] }],
};
const submission = {
  ...fields,
  submittedRevision: 2,
  sourcePublicationRevision: null,
  status: 'submitted',
  submittedAt: 100,
  reviewedAt: null,
  reason: '',
};
const status: ArticlePublicationStatus = {
  id,
  revision: 3,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  publicSlug: null,
  visible: false,
  latestSubmission: parseArticleSubmission(submission),
};
const published = {
  ...fields,
  id,
  revision: 1,
  submittedRevision: 2,
  publishedAt: 100,
  updatedAt: 100,
};

describe('retained anonymous article content', () => {
  it('removes the public byline while preserving the reviewed text, URL and cover without mutating history', () => {
    const input = { ...fields, cover: { imageId: id, alt: 'Reviewed cover' } };
    expect(anonymizeArticleFields(input)).toEqual({
      ...input,
      byline: 'Deleted account',
    });
    expect(input.byline).toBe('Alex writes');
    expect(anonymizeArticleFields(anonymizeArticleFields(input))).toEqual(
      anonymizeArticleFields(input)
    );
  });
  it('retains a maximum-sized article when replacing a one-character byline', () => {
    const input = {
      ...fields,
      byline: 'A',
      sections: [{ heading: '', paragraphs: Array(6).fill('x'.repeat(4000)) }],
    };
    const excess =
      JSON.stringify(input).length - ARTICLE_LIMITS.serializedContent;
    input.sections[0].paragraphs[5] = 'x'.repeat(4000 - excess);
    const approved = parseArticleFields(input);
    expect(JSON.stringify(approved)).toHaveLength(
      ARTICLE_LIMITS.serializedContent
    );
    const anonymous = anonymizeArticleFields(approved);
    expect(anonymous.sections).toEqual(approved.sections);
    expect(parseArticleFields(anonymous)).toEqual(anonymous);
  });
});

describe('reviewed article cover references', () => {
  it('preserves text-only payload hashes and carries reviewed covers through every content contract', () => {
    expect(JSON.stringify(parseArticleFields(fields))).toBe(
      JSON.stringify(fields)
    );
    const cover = {
      imageId: id,
      alt: 'A landscape showing the application in use',
    };
    expect(parseArticleFields({ ...fields, cover }).cover).toEqual(cover);
    expect(
      parseArticleDraft({
        ...fields,
        cover,
        id,
        revision: 1,
        createdAt: 1,
        updatedAt: 1,
      }).cover
    ).toEqual(cover);
    expect(parseArticleSubmission({ ...submission, cover }).cover).toEqual(
      cover
    );
    expect(
      articlePreview(parsePublishedArticle({ ...published, cover })).cover
    ).toEqual(cover);
  });
  it.each([
    null,
    { imageId: id, alt: '' },
    { imageId: id, alt: 'x'.repeat(301) },
    { imageId: '../path', alt: 'Cover' },
    { imageId: id, alt: 'Cover', url: 'https://example.test/a.png' },
  ])(
    'requires a bounded accessible description and a canonical ID (%j)',
    (cover) => {
      expect(() => parseArticleFields({ ...fields, cover })).toThrow();
    }
  );
});

describe('article content and public contracts', () => {
  it('preserves reviewed classification through publication and anonymity without rating legacy content', () => {
    expect(parseArticleFields(fields)).not.toHaveProperty('classification');
    const rated = { ...fields, classification: 'mature' as const };
    expect(anonymizeArticleFields(rated).classification).toBe('mature');
    expect(
      parseArticleSubmission({ ...submission, classification: 'mature' })
        .classification
    ).toBe('mature');
    expect(
      articlePreview(
        parsePublishedArticle({ ...published, classification: 'mature' })
      ).classification
    ).toBe('mature');
    for (const classification of [null, '', true, 'safe'])
      expect(() => parseArticleFields({ ...fields, classification })).toThrow(
        ArticleInputError
      );
  });
  it('normalizes supplied text and copies nested arrays without inventing attribution or content', () => {
    const parsed = parseArticleFields({
      ...fields,
      title: '  Working offline  ',
    });
    expect(parsed).toEqual(fields);
    parsed.sections[0].paragraphs[0] = 'changed';
    expect(fields.sections[0].paragraphs[0]).toBe('Actual supplied content.');
  });
  it.each([
    { byline: '' },
    { title: '' },
    { excerpt: '' },
    { sections: [] },
    { sections: [{ heading: '', paragraphs: [] }] },
    { tags: ['offline', 'offline'] },
    { ownerIdentityId: 'private-identity' },
    { coverImageUrl: 'https://mutable.example/image' },
    { sections: [{ heading: '', paragraphs: ['\ud800'] }] },
    { title: '\u0000' },
    { tags: ['UPPER'] },
    { title: 'x'.repeat(161) },
    { sections: [{ heading: '', paragraphs: ['x'.repeat(4001)] }] },
  ])('rejects incomplete or untrusted fields: %j', (change) =>
    expect(() => parseArticleFields({ ...fields, ...change })).toThrow(
      ArticleInputError
    )
  );
  it('bounds the entire snapshot, including JSON escaping and Unicode', () => {
    expect(() =>
      parseArticleFields({
        ...fields,
        sections: Array.from({ length: 10 }, () => ({
          heading: '',
          paragraphs: ['x'.repeat(3000)],
        })),
      })
    ).toThrow(ArticleInputError);
    const article = parseArticleFields({
      ...fields,
      sections: [
        {
          heading: '',
          paragraphs: Array.from({ length: 5 }, () => '漢'.repeat(3900)),
        },
      ],
    });
    expect(JSON.stringify(article).length).toBeLessThanOrEqual(
      ARTICLE_LIMITS.serializedContent
    );
    expect(Buffer.byteLength(JSON.stringify(article), 'utf8')).toBeLessThan(
      72_001
    );
  });
  it.each(['create', 'new', 'page', 'Foo', 'a/b', 'a--b', '', 'a'.repeat(101)])(
    'rejects a conflicting or unsafe slug %s',
    (slug) => expect(() => articleSlug(slug)).toThrow(ArticleInputError)
  );
  it('retains a permanent public URL after withdrawal', () => {
    expect(() => assertArticleSlug(fields, fields.slug)).not.toThrow();
    expect(() =>
      assertArticleSlug({ ...fields, slug: 'renamed' }, fields.slug)
    ).toThrow(ArticleConflictError);
  });
  it('validates canonical timestamps and never returns private IDs in public previews', () => {
    expect(articlePreview(parsePublishedArticle(published))).not.toHaveProperty(
      'sections'
    );
    expect(() =>
      parsePublishedArticle({ ...published, ownerIdentityId: 'private' })
    ).toThrow(ArticleInputError);
    expect(() =>
      parsePublishedArticle({ ...published, updatedAt: 99 })
    ).toThrow(ArticleInputError);
    expect(() =>
      parseArticleDraft({
        ...fields,
        id,
        revision: 1,
        createdAt: 100,
        updatedAt: 99,
      })
    ).toThrow(ArticleInputError);
  });
  it('validates bounded filters and preserves literal query characters', () => {
    expect(
      parseArticleBrowseQuery({
        q: '  a%_  ',
        category: 'Guides',
        tag: 'offline',
        page: '2',
      })
    ).toEqual({ q: 'a%_', category: 'Guides', tag: 'offline', page: 2 });
    for (const page of ['0', '01', '10001', '2.5', 1])
      expect(() => parseArticleBrowseQuery({ page })).toThrow(
        ArticleInputError
      );
    expect(() =>
      parseArticleBrowseQuery({ authorIdentityId: 'private' })
    ).toThrow(ArticleInputError);
  });
  it('rejects duplicate, unrequested, overlong and impossible selections/pages', () => {
    const preview = articlePreview(published);
    expect(parseArticleSelection({ items: [preview] }, [id])).toEqual({
      items: [preview],
    });
    expect(articleSelectionIds([id, id])).toEqual([id]);
    expect(() => articleSelectionIds(Array(51).fill(id))).toThrow(
      ArticleInputError
    );
    expect(() =>
      parseArticleSelection({ items: [preview, preview] }, [id])
    ).toThrow(ArticleInputError);
    expect(() =>
      parseArticleSelection(
        { items: [{ ...preview, id: '50000000-0000-4000-8000-000000000002' }] },
        [id]
      )
    ).toThrow(ArticleInputError);
    expect(() =>
      parseArticlePage({ items: [preview], total: 1, page: 2 })
    ).toThrow(ArticleInputError);
    expect(() =>
      parseArticlePage({ items: [published], total: 1, page: 1 })
    ).toThrow(ArticleInputError);
  });
});
describe('article publication invariants', () => {
  const approve = {
    expectedRevision: 3,
    expectedPublicationRevision: null,
    submittedRevision: 2,
    reason: '',
  };
  it('reviews exactly the immutable submitted revision after later private editing', () => {
    expect(() =>
      assertArticlePublicationTransition(
        'approve',
        { ...status, revision: 4 },
        { ...approve, expectedRevision: 4 }
      )
    ).not.toThrow();
    expect(() =>
      assertArticlePublicationTransition('approve', status, {
        ...approve,
        submittedRevision: 1,
      })
    ).toThrow(ArticleConflictError);
    expect(() =>
      assertArticlePublicationTransition('approve', status, {
        ...approve,
        expectedRevision: 2,
      })
    ).toThrow(ArticleConflictError);
  });
  it('requires a new submission when public authority changed', () => {
    const changed = {
      ...status,
      publicationRevision: 2,
      publishedSubmissionRevision: 1,
      publicSlug: fields.slug,
    };
    expect(() =>
      assertArticlePublicationTransition('approve', changed, {
        ...approve,
        expectedPublicationRevision: 2,
      })
    ).toThrow(ArticleConflictError);
  });
  it('rejects duplicate submission, stale review, empty withdrawal and counter exhaustion', () => {
    expect(() =>
      assertArticlePublicationTransition('submit', status, approve)
    ).toThrow(ArticleConflictError);
    expect(() =>
      assertArticlePublicationTransition(
        'reject',
        { ...status, latestSubmission: null },
        approve
      )
    ).toThrow(ArticleConflictError);
    expect(() =>
      assertArticlePublicationTransition(
        'withdraw',
        { ...status, latestSubmission: null },
        approve
      )
    ).toThrow(ArticleConflictError);
    expect(() =>
      assertArticlePublicationTransition(
        'approve',
        { ...status, revision: Number.MAX_SAFE_INTEGER },
        { ...approve, expectedRevision: Number.MAX_SAFE_INTEGER }
      )
    ).toThrow(ArticleConflictError);
  });
  it('requires explicit withdrawal before deleting public or submitted content', () => {
    expect(() => assertArticleDeletion(status)).toThrow(ArticleConflictError);
    expect(() =>
      assertArticleDeletion({
        ...status,
        latestSubmission: null,
        visible: true,
      })
    ).toThrow(ArticleConflictError);
    expect(() =>
      assertArticleDeletion({ ...status, latestSubmission: null })
    ).not.toThrow();
  });
  it('requires reasons for rejection and rejects extra decision data', () => {
    expect(() => parseArticlePublicationInput('reject', approve)).toThrow(
      ArticleInputError
    );
    expect(
      parseArticlePublicationInput('reject', {
        ...approve,
        reason: 'Please supply sources.',
      }).reason
    ).toBe('Please supply sources.');
    expect(() => parseArticlePublicationInput('submit', approve)).toThrow(
      ArticleInputError
    );
    expect(() =>
      parseArticlePublicationInput('submit', { expectedRevision: 3 })
    ).toThrow(ArticleInputError);
  });
  it.each([
    { status: 'approved' },
    { status: 'rejected', reviewedAt: 101 },
    { reviewedAt: 101 },
    { status: 'cancelled', reviewedAt: 99 },
    { reason: 'unexpected' },
  ])('rejects inconsistent review records %j', (change) =>
    expect(() => parseArticleSubmission({ ...submission, ...change })).toThrow(
      ArticleInputError
    )
  );
  it('rejects publication status and receipt inconsistencies', () => {
    expect(parseArticlePublicationStatus(status)).toEqual(status);
    expect(() =>
      parseArticlePublicationStatus({ ...status, visible: true })
    ).toThrow(ArticleInputError);
    expect(() =>
      parseArticlePublicationStatus({ ...status, publicSlug: fields.slug })
    ).toThrow(ArticleInputError);
    expect(() =>
      parseArticlePublicationStatus({ ...status, revision: 2 })
    ).toThrow(ArticleInputError);
    expect(() =>
      parseArticlePublicationReceipt({
        id,
        revision: 3,
        action: 'approve',
        submittedRevision: 2,
        publicationRevision: null,
      })
    ).toThrow(ArticleInputError);
    expect(() =>
      parseArticleReviewPage({
        items: [{ ...status, latestSubmission: null }],
        total: 1,
        page: 1,
      })
    ).toThrow(ArticleInputError);
  });
});
