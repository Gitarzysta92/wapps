import { editorialRetirementConflict } from './editorial-media-retirement';
import type { EditorialMediaAsset } from './editorial-media-assets';

const retired: EditorialMediaAsset = {
  kind: 'article',
  imageId: '019a0010-0000-7000-8000-000000000001',
  articleId: '019a0010-0000-7000-8000-000000000002',
  tenantId: 'default',
  asset: null,
  createdAt: 100,
  retiredAt: 200,
};
const upload = {
  tenantId: retired.tenantId,
  articleId: retired.articleId,
  createdAt: '100',
  status: 'cancelled',
  revision: '3',
  asset: null,
  leaseToken: null,
  leaseUntil: null,
  commandKey: null,
};

describe('media-byte retirement authority', () => {
  it('keeps exact retirement authority after private upload history is erased', () => {
    expect(editorialRetirementConflict(retired, 200, upload)).toBe(false);
    expect(editorialRetirementConflict(retired, 200, undefined)).toBe(false);
  });
  it('denies missing, live and mismatched registry authority', () => {
    expect(editorialRetirementConflict(null, 200, upload)).toBe(true);
    expect(
      editorialRetirementConflict(
        { ...retired, retiredAt: null },
        200,
        undefined
      )
    ).toBe(true);
    expect(editorialRetirementConflict(retired, 201, undefined)).toBe(true);
  });
  it.each([
    { status: 'ready' },
    { asset: {} },
    { revision: 1 },
    { tenantId: 'other' },
    { articleId: retired.imageId },
    { createdAt: 101 },
    { leaseToken: 'a'.repeat(64) },
    { leaseUntil: 300 },
    { commandKey: 'pending-upload' },
  ])('denies inconsistent remaining private history %#', (patch) => {
    expect(
      editorialRetirementConflict(retired, 200, { ...upload, ...patch })
    ).toBe(true);
  });
});
