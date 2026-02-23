import { PlatformMongoClient } from './mongo';

describe('PlatformMongoClient', () => {
  it('should work', () => {
    const client = new PlatformMongoClient();
    expect(client).toBeInstanceOf(PlatformMongoClient);
  });
});
