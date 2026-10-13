import { createHash } from 'node:crypto';
import sharp, { type Sharp } from 'sharp';
import {
  PROFILE_AVATAR_SOURCE_LIMIT,
  PROFILE_AVATAR_OUTPUT_LIMIT,
  PROFILE_AVATAR_DIMENSION,
  PROFILE_AVATAR_PIXEL_LIMIT,
  type ProfileAvatarChange,
} from '@domains/customer/profiles';
import {
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import type { ProfileAvatarNormalizer } from '@sdk/features/identity/libs/management';

export class SharpProfileAvatars implements ProfileAvatarNormalizer {
  private active = 0;

  async normalize(
    bytes: Uint8Array,
    source: NonNullable<ProfileAvatarChange['source']>
  ) {
    if (
      bytes.byteLength < 1 ||
      bytes.byteLength > PROFILE_AVATAR_SOURCE_LIMIT ||
      bytes.byteLength !== source.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== source.sha256
    )
      throw new CanonicalIdentityInputError(
        'Photo bytes do not match the upload'
      );
    const data = Buffer.from(bytes);
    const matches =
      source.contentType === 'image/png'
        ? data
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : source.contentType === 'image/jpeg'
        ? data[0] === 255 && data[1] === 216 && data[2] === 255
        : data.toString('ascii', 0, 4) === 'RIFF' &&
          data.toString('ascii', 8, 12) === 'WEBP';
    if (!matches)
      throw new CanonicalIdentityInputError(
        'Photo format does not match its declared type'
      );
    if (this.active >= 2)
      throw new CanonicalIdentityUnavailable('Photo processing is busy');
    this.active++;
    let image: Sharp | undefined;
    try {
      image = sharp(data, {
        limitInputPixels: PROFILE_AVATAR_PIXEL_LIMIT,
        failOn: 'warning',
        pages: 1,
        sequentialRead: true,
      }).timeout({ seconds: 5 });
      const metadata = await image.metadata();
      if (
        'image/' + metadata.format !== source.contentType ||
        (metadata.pages ?? 1) !== 1 ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > 8192 ||
        metadata.height > 8192 ||
        metadata.width * metadata.height > PROFILE_AVATAR_PIXEL_LIMIT
      )
        throw new CanonicalIdentityInputError(
          'Use a still PNG, JPEG or WebP within the dimension limits'
        );
      const result = await image
        .rotate()
        .resize({
          width: PROFILE_AVATAR_DIMENSION,
          height: PROFILE_AVATAR_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (result.data.byteLength > PROFILE_AVATAR_OUTPUT_LIMIT)
        throw new CanonicalIdentityInputError('Normalized photo is too large');
      return {
        bytes: result.data,
        width: result.info.width,
        height: result.info.height,
      };
    } catch (error) {
      if (error instanceof CanonicalIdentityInputError) throw error;
      throw new CanonicalIdentityInputError(
        'Photo could not be decoded within the processing limits'
      );
    } finally {
      image?.destroy();
      this.active--;
    }
  }
}
