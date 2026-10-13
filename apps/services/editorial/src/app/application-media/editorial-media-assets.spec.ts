import { editorialMediaAsset } from './editorial-media-assets';

const id = '019a0010-0000-7000-8000-000000000001';
const articleId = '019a0010-0000-7000-8000-000000000002';
const asset = {
  id,
  purpose: 'banner',
  contentType: 'image/webp',
  bytes: 32,
  sha256: 'a'.repeat(64),
  width: 800,
  height: 300,
};
const row = {
  kind: 'application',
  imageId: id,
  tenantId: 'default',
  articleId: null,
  asset,
  createdAt: 1,
  retiredAt: null,
};

describe('canonical Editorial media descriptors', () => {
  it('keeps only immutable byte metadata and canonical scope', () => {
    expect(
      editorialMediaAsset({
        ...row,
        ownerIdentityId: 'PrivateUploader',
        sourceSha256: 'PrivateSource',
      })
    ).toEqual(row);
  });
  it('accepts SQL numeric/JSON representations and a payload-free retired key', () => {
    expect(
      editorialMediaAsset({
        ...row,
        createdAt: '1',
        asset: JSON.stringify(asset),
      })
    ).toEqual(row);
    expect(
      editorialMediaAsset({ ...row, asset: null, retiredAt: '2' })
    ).toEqual({ ...row, asset: null, retiredAt: 2 });
  });
  it('binds covers to the exact article and distinguishes their descriptor namespace', () => {
    const cover: Partial<typeof asset> = { ...asset };
    delete cover.purpose;
    expect(
      editorialMediaAsset({ ...row, kind: 'article', articleId, asset: cover })
    ).toEqual({ ...row, kind: 'article', articleId, asset: cover });
    expect(() =>
      editorialMediaAsset({ ...row, kind: 'article', articleId })
    ).toThrow();
  });
  it.each([
    { kind: 'unknown' },
    { imageId: articleId },
    { tenantId: '' },
    { articleId },
    { kind: 'article' },
    { asset: null },
    { retiredAt: 2 },
    { asset: null, retiredAt: 0 },
    { createdAt: null },
    { createdAt: Number.MAX_SAFE_INTEGER + 1 },
    { asset: { ...asset, sha256: 'invalid' } },
  ])('rejects inconsistent scope, bytes and lifecycle %#', (patch) => {
    expect(() => editorialMediaAsset({ ...row, ...patch })).toThrow();
  });
});
