import {
  ARTICLE_COVER_SOURCE_LIMIT,
  ARTICLE_COVER_UPLOAD_LIFETIME,
  ARTICLE_COVER_UNUSED_LIFETIME,
  parseArticleCoverAsset,
  parseArticleCoverUploadInput,
  parseArticleCoverUpload,
  assertArticleCoverUploadWritable,
  assertArticleCoverCancellation,
  articleCoverRetirementReason,
} from './article-cover';

const id = '019a0010-0000-7000-8000-000000000001';
const articleId = '019a0010-0000-7000-8000-000000000002';
const source = { contentType: 'image/png', bytes: 100, sha256: 'a'.repeat(64) };
const input = { articleId, source };
const asset = {
  id,
  contentType: 'image/webp',
  bytes: 90,
  sha256: 'b'.repeat(64),
  width: 2560,
  height: 1440,
};
const pending = {
  id,
  ...input,
  status: 'pending',
  revision: 1,
  createdAt: 10,
  expiresAt: 10 + ARTICLE_COVER_UPLOAD_LIFETIME,
  asset: null,
};

describe('article cover lifecycle', () => {
  it('keeps article ownership separate and validates bounded landscape assets', () => {
    expect(parseArticleCoverUploadInput(input)).toEqual(input);
    expect(parseArticleCoverAsset(asset)).toEqual(asset);
    expect(
      parseArticleCoverUpload({
        ...pending,
        status: 'ready',
        revision: 2,
        asset,
      }).asset
    ).toEqual(asset);
  });
  it.each([
    { ...input, draftId: articleId },
    { ...input, purpose: 'banner' },
    { ...input, ownerIdentityId: 'caller' },
    { ...input, objectKey: 'override' },
    { ...input, source: { ...source, bytes: ARTICLE_COVER_SOURCE_LIMIT + 1 } },
    { ...input, source: { ...source, contentType: 'image/svg+xml' } },
    { ...input, articleId: '../path' },
  ])(
    'rejects caller authority, application slots, paths and unsafe sources (%j)',
    (value) => {
      expect(() => parseArticleCoverUploadInput(value)).toThrow();
    }
  );
  it.each([
    { ...asset, width: 2561 },
    { ...asset, height: 1441 },
    { ...asset, purpose: 'banner' },
    { ...asset, url: 'https://example.test/image' },
  ])('rejects invalid cover metadata (%j)', (value) => {
    expect(() => parseArticleCoverAsset(value)).toThrow();
  });
  it('requires exact pending revisions before expiry and forbids referenced cancellation', () => {
    const upload = parseArticleCoverUpload(pending);
    expect(() => assertArticleCoverUploadWritable(upload, 1, 10)).not.toThrow();
    expect(() => assertArticleCoverUploadWritable(upload, 2, 10)).toThrow();
    expect(() =>
      assertArticleCoverUploadWritable(upload, 1, upload.expiresAt)
    ).toThrow();
    expect(() => assertArticleCoverCancellation(upload, 1, true)).toThrow();
    expect(() =>
      parseArticleCoverUpload({
        ...pending,
        status: 'ready',
        asset: { ...asset, id: articleId },
      })
    ).toThrow();
  });
  it('protects all canonical references during retention and fences cancelled uploads', () => {
    const ready = parseArticleCoverUpload({
      ...pending,
      status: 'ready',
      revision: 2,
      asset,
    });
    const at = ready.createdAt + ARTICLE_COVER_UNUSED_LIFETIME;
    expect(articleCoverRetirementReason(ready, true, true, at)).toBeNull();
    expect(
      articleCoverRetirementReason(ready, false, false, at - 1)
    ).toBeNull();
    expect(articleCoverRetirementReason(ready, false, false, at)).toBe(
      'unreferenced'
    );
    expect(articleCoverRetirementReason(ready, false, true, at)).toBe(
      'draft-deleted'
    );
  });
});
