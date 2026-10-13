import sharp from 'sharp';
import { SharpApplicationImages } from './sharp-application-images';
import type { ApplicationImageSourceType } from '@domains/catalog/media';

const raster = () =>
  sharp({
    create: {
      width: 40,
      height: 20,
      channels: 4,
      background: { r: 40, g: 100, b: 200, alpha: 0.5 },
    },
  });
describe('bounded application image normalization', () => {
  it.each(['png', 'jpeg', 'webp'] as const)(
    'decodes %s, preserves dimensions and emits a complete WebP without metadata',
    async (format) => {
      const bytes = await raster()
        .withMetadata({ exif: { IFD0: { Artist: 'Private upload metadata' } } })
        .toFormat(format)
        .toBuffer();
      const result = await new SharpApplicationImages().normalize(
        bytes,
        'logo',
        `image/${format}`
      );
      const metadata = await sharp(result.bytes).metadata();
      expect(result).toMatchObject({ width: 40, height: 20 });
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      await expect(
        sharp(result.bytes).raw().toBuffer()
      ).resolves.toBeInstanceOf(Buffer);
    }
  );
  it('bounds normalized dimensions without enlarging or cropping the source', async () => {
    const bytes = await sharp({
      create: { width: 2048, height: 512, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const result = await new SharpApplicationImages().normalize(
      bytes,
      'logo',
      'image/png'
    );
    expect(result).toMatchObject({ width: 1024, height: 256 });
  });
  it.each([
    [
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
      ),
      'image/png',
    ],
    [Buffer.from('GIF89a'), 'image/webp'],
    [Buffer.from([255, 216, 255, 0]), 'image/jpeg'],
  ] as [Buffer, ApplicationImageSourceType][])(
    'rejects unsupported and corrupt content before publishing anything',
    async (bytes, contentType) => {
      await expect(
        new SharpApplicationImages().normalize(bytes, 'logo', contentType)
      ).rejects.toThrow();
    }
  );
  it('rejects a MIME mismatch and an excessive dimension', async () => {
    const bytes = await raster().png().toBuffer();
    const normalizer = new SharpApplicationImages();
    await expect(
      normalizer.normalize(bytes, 'logo', 'image/jpeg')
    ).rejects.toThrow('declared');
    const wide = await sharp({
      create: { width: 8193, height: 1, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(
      normalizer.normalize(wide, 'banner', 'image/png')
    ).rejects.toThrow('dimension');
  });
  it('bounds concurrent decoding and recovers capacity after processing', async () => {
    const bytes = await raster().png().toBuffer();
    const normalizer = new SharpApplicationImages();
    const first = normalizer.normalize(bytes, 'logo', 'image/png');
    const second = normalizer.normalize(bytes, 'logo', 'image/png');
    await expect(
      normalizer.normalize(bytes, 'logo', 'image/png')
    ).rejects.toThrow('busy');
    await Promise.all([first, second]);
    await expect(
      normalizer.normalize(bytes, 'logo', 'image/png')
    ).resolves.toMatchObject({ width: 40, height: 20 });
  });
  it('rejects truncated PNG, animated WebP and excessive decoded pixels', async () => {
    const normalizer = new SharpApplicationImages();
    const png = await raster().png().toBuffer();
    await expect(
      normalizer.normalize(
        png.subarray(0, png.length - 25),
        'logo',
        'image/png'
      )
    ).rejects.toThrow();
    const frames = Buffer.concat([
      Buffer.alloc(10 * 10 * 3, 0),
      Buffer.alloc(10 * 10 * 3, 255),
    ]);
    const animation = await sharp(frames, {
      raw: { width: 10, height: 20, pageHeight: 10, channels: 3 },
    })
      .webp({ delay: [100, 100], loop: 0 })
      .toBuffer();
    expect((await sharp(animation, { animated: true }).metadata()).pages).toBe(
      2
    );
    await expect(
      normalizer.normalize(animation, 'logo', 'image/webp')
    ).rejects.toThrow('still');
    const pixels = await sharp({
      create: { width: 5000, height: 4001, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(
      normalizer.normalize(pixels, 'banner', 'image/png')
    ).rejects.toThrow('processing limits');
    await expect(
      normalizer.normalize(png, 'logo', 'image/png')
    ).resolves.toMatchObject({ width: 40, height: 20 });
  });
});
