import sharp, { type Sharp } from 'sharp';
import {
  APPLICATION_IMAGE_SOURCE_LIMIT,
  APPLICATION_IMAGE_OUTPUT_LIMIT,
  APPLICATION_IMAGE_PIXEL_LIMIT,
  APPLICATION_IMAGE_DIMENSION_LIMIT,
  APPLICATION_IMAGE_OUTPUT_BOUNDS,
  ApplicationImageInputError,
  ApplicationImageUnavailableError,
  type ApplicationImagePurpose,
  type ApplicationImageSourceType,
} from '@domains/catalog/media';
import type { ApplicationImageNormalizer } from './application-image.ports';

/** Decode and re-encode only bounded still images; filenames and embedded metadata are never published. */
export class SharpApplicationImages implements ApplicationImageNormalizer {
  private active = 0;
  async normalize(
    bytes: Uint8Array,
    purpose: ApplicationImagePurpose,
    contentType: ApplicationImageSourceType
  ) {
    if (
      bytes.byteLength < 1 ||
      bytes.byteLength > APPLICATION_IMAGE_SOURCE_LIMIT
    )
      throw new ApplicationImageInputError(
        'Image body exceeds the upload limit'
      );
    if (!matchesSignature(bytes, contentType))
      throw new ApplicationImageInputError(
        'The file does not match its declared PNG, JPEG or WebP format'
      );
    if (this.active >= 2)
      throw new ApplicationImageUnavailableError(
        'Image processing is busy. Retry the same upload shortly.'
      );
    this.active++;
    let image: Sharp | undefined;
    try {
      image = sharp(Buffer.from(bytes), {
        limitInputPixels: APPLICATION_IMAGE_PIXEL_LIMIT,
        failOn: 'warning',
        pages: 1,
        sequentialRead: true,
      }).timeout({ seconds: 5 });
      const metadata = await image.metadata();
      if (
        !['png', 'jpeg', 'webp'].includes(metadata.format) ||
        'image/' + metadata.format !== contentType ||
        (metadata.pages ?? 1) !== 1 ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > APPLICATION_IMAGE_DIMENSION_LIMIT ||
        metadata.height > APPLICATION_IMAGE_DIMENSION_LIMIT ||
        metadata.width * metadata.height > APPLICATION_IMAGE_PIXEL_LIMIT
      )
        throw new ApplicationImageInputError(
          'Use a still PNG, JPEG or WebP within the image dimension limits'
        );
      const result = await image
        .rotate()
        .resize({
          ...APPLICATION_IMAGE_OUTPUT_BOUNDS[purpose],
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 90, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (result.data.byteLength > APPLICATION_IMAGE_OUTPUT_LIMIT)
        throw new ApplicationImageInputError(
          'The normalized image exceeds the storage limit'
        );
      return {
        bytes: result.data,
        width: result.info.width,
        height: result.info.height,
      };
    } catch (error) {
      if (error instanceof ApplicationImageInputError) throw error;
      throw new ApplicationImageInputError(
        'The image could not be decoded within the processing limits'
      );
    } finally {
      image?.destroy();
      this.active--;
    }
  }
}

function matchesSignature(
  bytes: Uint8Array,
  type: ApplicationImageSourceType
): boolean {
  const value = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 'image/png')
    return (
      value.length >= 8 &&
      value
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  if (type === 'image/jpeg')
    return (
      value.length >= 3 &&
      value[0] === 255 &&
      value[1] === 216 &&
      value[2] === 255
    );
  return (
    value.length >= 12 &&
    value.toString('ascii', 0, 4) === 'RIFF' &&
    value.toString('ascii', 8, 12) === 'WEBP'
  );
}
