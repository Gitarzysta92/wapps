import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { SharpProfileAvatars } from './sharp-profile-avatars';

const source = (
  bytes: Buffer,
  contentType: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png'
) => ({
  bytes: bytes.length,
  contentType,
  sha256: createHash('sha256').update(bytes).digest('hex'),
});
describe('private photo normalization', () => {
  it('bounds dimensions and strips source metadata while producing a decodable WebP', async () => {
    const bytes = await sharp({
      create: { width: 1000, height: 800, channels: 3, background: 'red' },
    })
      .png()
      .withMetadata({ density: 300 })
      .toBuffer();
    const image = await new SharpProfileAvatars().normalize(
      bytes,
      source(bytes)
    );
    expect(image).toMatchObject({ width: 512, height: 410 });
    const metadata = await sharp(image.bytes).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(image.bytes.length).toBeLessThanOrEqual(256 * 1024);
  });
  it('rejects spoofed formats, mismatched length/digest, truncated images and oversized inputs', async () => {
    const bytes = await sharp({
      create: { width: 10, height: 10, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const normalizer = new SharpProfileAvatars();
    for (const metadata of [
      source(bytes, 'image/jpeg'),
      { ...source(bytes), bytes: 1 },
      { ...source(bytes), sha256: '0'.repeat(64) },
    ])
      await expect(normalizer.normalize(bytes, metadata)).rejects.toThrow();
    const truncated = bytes.subarray(0, 20);
    await expect(
      normalizer.normalize(truncated, source(truncated))
    ).rejects.toThrow();
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1);
    await expect(
      normalizer.normalize(oversized, source(oversized))
    ).rejects.toThrow();
  });
  it('rejects excessive dimensions and animated images', async () => {
    const wide = await sharp({
      create: { width: 8193, height: 1, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(
      new SharpProfileAvatars().normalize(wide, source(wide))
    ).rejects.toThrow();
    const animated = await sharp(
      Buffer.concat([Buffer.alloc(12, 255), Buffer.alloc(12, 0)]),
      { raw: { width: 2, height: 4, channels: 3, pageHeight: 2 } }
    )
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    await expect(
      new SharpProfileAvatars().normalize(
        animated,
        source(animated, 'image/webp')
      )
    ).rejects.toThrow();
  });
});
