import {
  APPLICATION_IMAGE_UPLOAD_LIFETIME,
  type ApplicationImageUpload,
} from './application-image';
import {
  APPLICATION_IMAGE_UNUSED_LIFETIME,
  applicationImageRetirementReason,
  assertApplicationImageCancellation,
} from './application-image-retention';

const pending: ApplicationImageUpload = {
  id: '019a0010-0000-7000-8000-000000000001',
  draftId: '019a0010-0000-7000-8000-000000000002',
  purpose: 'logo',
  source: { bytes: 1, contentType: 'image/png', sha256: 'a'.repeat(64) },
  status: 'pending',
  revision: 1,
  asset: null,
  createdAt: 100,
  expiresAt: 100 + APPLICATION_IMAGE_UPLOAD_LIFETIME,
};
const ready: ApplicationImageUpload = {
  ...pending,
  status: 'ready',
  revision: 2,
  asset: {
    id: pending.id,
    purpose: 'logo',
    contentType: 'image/webp',
    bytes: 1,
    width: 1,
    height: 1,
    sha256: 'b'.repeat(64),
  },
};

describe('application image retirement', () => {
  it('permits explicit cancellation only at the current revision and without references', () => {
    expect(() =>
      assertApplicationImageCancellation(pending, 1, false)
    ).not.toThrow();
    expect(() =>
      assertApplicationImageCancellation(ready, 2, false)
    ).not.toThrow();
    expect(() => assertApplicationImageCancellation(ready, 1, false)).toThrow(
      'changed'
    );
    expect(() => assertApplicationImageCancellation(ready, 2, true)).toThrow(
      'still used'
    );
    expect(() =>
      assertApplicationImageCancellation(
        { ...pending, status: 'cancelled', revision: 2 },
        2,
        false
      )
    ).toThrow('changed');
  });
  it('never automatically retires referenced images, even after draft deletion or long expiry', () => {
    for (const upload of [pending, ready])
      expect(
        applicationImageRetirementReason(
          upload,
          true,
          true,
          100 + APPLICATION_IMAGE_UNUSED_LIFETIME * 2
        )
      ).toBeNull();
  });
  it('expires pending reservations exactly at their deadline and retains unreferenced ready images for seven days', () => {
    expect(
      applicationImageRetirementReason(
        pending,
        false,
        false,
        pending.expiresAt - 1
      )
    ).toBeNull();
    expect(
      applicationImageRetirementReason(pending, false, false, pending.expiresAt)
    ).toBe('expired');
    expect(
      applicationImageRetirementReason(
        ready,
        false,
        false,
        99 + APPLICATION_IMAGE_UNUSED_LIFETIME
      )
    ).toBeNull();
    expect(
      applicationImageRetirementReason(
        ready,
        false,
        false,
        100 + APPLICATION_IMAGE_UNUSED_LIFETIME
      )
    ).toBe('unreferenced');
  });
  it('allows unreferenced deleted-draft cleanup without replaying terminal retirement or trusting a backwards clock', () => {
    expect(applicationImageRetirementReason(ready, false, true, 100)).toBe(
      'draft-deleted'
    );
    expect(applicationImageRetirementReason(ready, false, true, 99)).toBeNull();
    expect(
      applicationImageRetirementReason(
        { ...pending, status: 'cancelled', revision: 2 },
        false,
        true,
        pending.expiresAt
      )
    ).toBeNull();
  });
});
