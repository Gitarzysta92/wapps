import { ConfigService } from '@nestjs/config';
import { ConfiguredApplicationImageObjects } from './configured-application-image-objects';
import {
  ApplicationImageUnavailableError,
  type ApplicationImageAsset,
} from '@domains/catalog/media';

describe('explicit private image storage configuration', () => {
  const asset: ApplicationImageAsset = {
    id: '019a0010-0000-7000-8000-000000000001',
    purpose: 'logo',
    contentType: 'image/webp',
    bytes: 1,
    sha256: 'a'.repeat(64),
    width: 1,
    height: 1,
  };
  const configured = {
    EDITORIAL_MEDIA_ENDPOINT: 'http://127.0.0.1:9000',
    EDITORIAL_MEDIA_BUCKET: 'private-images',
    EDITORIAL_MEDIA_ACCESS_KEY: 'configured-user',
    EDITORIAL_MEDIA_SECRET_KEY: 'configured-secret',
  };
  it.each([
    {},
    { ...configured, EDITORIAL_MEDIA_SECRET_KEY: '' },
    {
      ...configured,
      EDITORIAL_MEDIA_ENDPOINT: 'https://user:secret@example.test',
    },
    { ...configured, EDITORIAL_MEDIA_ENDPOINT: 'file:///tmp/media' },
    {
      ...configured,
      EDITORIAL_MEDIA_ENDPOINT: 'https://example.test/a-bucket',
    },
    { ...configured, EDITORIAL_MEDIA_BUCKET: '../another-bucket' },
  ])(
    'fails closed without falling back to another storage provider: %j',
    (configuration) => {
      const objects = new ConfiguredApplicationImageObjects(
        new ConfigService(configuration)
      );
      expect(() => objects.putImmutable(asset, Buffer.alloc(1))).toThrow(
        ApplicationImageUnavailableError
      );
      expect(() => objects.read(asset)).toThrow('not configured');
      objects.onModuleDestroy();
    }
  );
});
