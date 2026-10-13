import {
  APPLICATION_IMAGE_SOURCE_LIMIT,
  APPLICATION_IMAGE_UPLOAD_LIFETIME,
  parseApplicationImageAsset,
  parseApplicationImageUploadInput,
  parseApplicationImageUpload,
  assertApplicationImageUploadWritable,
  type ApplicationImageUpload,
} from './application-image';

const id = '019a0010-0000-7000-8000-000000000001';
const draftId = '019a0010-0000-7000-8000-000000000002';
const source = { contentType: 'image/png', bytes: 128, sha256: 'a'.repeat(64) };
const input = { draftId, purpose: 'logo', source };
const asset = {
  id,
  purpose: 'logo',
  contentType: 'image/webp',
  bytes: 94,
  sha256: 'b'.repeat(64),
  width: 64,
  height: 64,
};
const upload = {
  id,
  ...input,
  revision: 1,
  status: 'pending',
  createdAt: 10,
  expiresAt: 10 + APPLICATION_IMAGE_UPLOAD_LIFETIME,
  asset: null,
};

describe('private application image contracts', () => {
  it('pins an upload to one draft, purpose, source format, byte count and content digest', () => {
    expect(parseApplicationImageUploadInput(input)).toEqual(input);
    expect(parseApplicationImageUpload(upload)).toEqual(upload);
    expect(
      parseApplicationImageUpload({
        ...upload,
        revision: 2,
        status: 'ready',
        asset,
      })
    ).toMatchObject({ asset });
  });
  it.each([
    { ...input, ownerIdentityId: 'attacker' },
    { ...input, tenantId: 'other' },
    { ...input, objectKey: 'public/override' },
    { ...input, url: 'https://example.test/image' },
    { ...input, draftId: '../other' },
    { ...input, purpose: 'avatar' },
    { ...input, source: { ...source, contentType: 'image/svg+xml' } },
    {
      ...input,
      source: { ...source, bytes: APPLICATION_IMAGE_SOURCE_LIMIT + 1 },
    },
    { ...input, source: { ...source, bytes: 0 } },
    { ...input, source: { ...source, bytes: 1.5 } },
    { ...input, source: { ...source, sha256: 'A'.repeat(64) } },
    { ...input, source: { ...source, sha256: '' } },
  ])(
    'rejects authority, storage overrides and invalid source metadata: %j',
    (value) => {
      expect(() => parseApplicationImageUploadInput(value)).toThrow();
    }
  );
  it.each([
    { ...asset, width: 1025 },
    { ...asset, height: 0 },
    { ...asset, contentType: 'image/png' },
    { ...asset, purpose: 'banner', width: 2561 },
    { ...asset, bytes: APPLICATION_IMAGE_SOURCE_LIMIT + 1 },
    { ...asset, objectKey: 'mutable' },
  ])('rejects unbounded or storage-shaped output: %j', (value) => {
    expect(() => parseApplicationImageAsset(value)).toThrow();
  });
  it.each([
    { ...upload, status: 'ready' },
    { ...upload, asset },
    { ...upload, status: 'cancelled', asset },
    { ...upload, status: 'ready', asset: { ...asset, id: draftId } },
    { ...upload, status: 'ready', asset: { ...asset, purpose: 'banner' } },
    { ...upload, expiresAt: upload.expiresAt + 1 },
  ])('rejects inconsistent lifecycle or asset bindings: %j', (value) => {
    expect(() => parseApplicationImageUpload(value)).toThrow();
  });
  it('permits only the loaded pending revision before expiry', () => {
    const parsed = parseApplicationImageUpload(upload);
    expect(() =>
      assertApplicationImageUploadWritable(parsed, 1, 10)
    ).not.toThrow();
    for (const [value, revision, at] of [
      [parsed, 2, 10],
      [parsed, 1, parsed.expiresAt],
      [parsed, 1, 9],
      [{ ...parsed, status: 'cancelled' }, 1, 10],
    ] as [ApplicationImageUpload, number, number][])
      expect(() =>
        assertApplicationImageUploadWritable(value, revision, at)
      ).toThrow();
  });
});
