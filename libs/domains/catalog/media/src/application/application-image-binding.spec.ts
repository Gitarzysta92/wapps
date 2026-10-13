import {
  parseApplicationImageSet,
  parseApplicationImageChange,
  parseApplicationImageMerge,
} from './application-image-binding';

describe('application image binding contracts', () => {
  const id = '019a0010-0000-7000-8000-000000000001';
  const asset = {
    id,
    purpose: 'logo',
    contentType: 'image/webp',
    bytes: 32,
    sha256: 'a'.repeat(64),
    width: 10,
    height: 10,
  };
  it('distinguishes an immutable upload, an existing external URL and explicit removal', () => {
    const images = {
      logo: { kind: 'upload', asset },
      banner: { kind: 'external', url: 'https://example.test/banner.png' },
    };
    expect(parseApplicationImageSet(images)).toEqual(images);
    expect(parseApplicationImageSet({ logo: null, banner: null })).toEqual({
      logo: null,
      banner: null,
    });
    expect(
      parseApplicationImageChange({
        expectedRevision: 2,
        purpose: 'logo',
        imageId: null,
      })
    ).toEqual({ expectedRevision: 2, purpose: 'logo', imageId: null });
  });
  it.each([
    {
      logo: { kind: 'upload', asset: { ...asset, purpose: 'banner' } },
      banner: null,
    },
    {
      logo: { kind: 'upload', asset, url: 'https://override.test' },
      banner: null,
    },
    { logo: { kind: 'external', url: 'javascript:alert(1)' }, banner: null },
    {
      logo: { kind: 'external', url: 'https://user:secret@example.test' },
      banner: null,
    },
    {
      logo: {
        kind: 'external',
        url: 'https://example.test/' + 'a'.repeat(255),
      },
      banner: null,
    },
    { logo: null },
    { logo: null, banner: null, ownerIdentityId: 'other' },
  ])('rejects inconsistent or unsafe image snapshots: %j', (input) =>
    expect(() => parseApplicationImageSet(input)).toThrow()
  );
  it('accepts only a revision-bound image ID, not a caller-supplied descriptor or external URL', () => {
    expect(
      parseApplicationImageChange({
        expectedRevision: 1,
        purpose: 'logo',
        imageId: id,
      }).imageId
    ).toBe(id);
    for (const extra of [
      { asset },
      { url: 'https://example.test' },
      { ownerIdentityId: 'other' },
      { tenantId: 'other' },
    ])
      expect(() =>
        parseApplicationImageChange({
          expectedRevision: 1,
          purpose: 'logo',
          imageId: id,
          ...extra,
        })
      ).toThrow();
  });
  it('requires an explicit merge choice for both image purposes', () => {
    expect(
      parseApplicationImageMerge({ logo: 'draft', banner: 'canonical' })
    ).toEqual({ logo: 'draft', banner: 'canonical' });
    expect(() => parseApplicationImageMerge({ logo: 'draft' })).toThrow();
    expect(() =>
      parseApplicationImageMerge({ logo: null, banner: 'canonical' })
    ).toThrow();
  });
});
