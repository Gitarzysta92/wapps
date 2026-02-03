import { minio } from './minio';

describe('minio', () => {
  it('should work', () => {
    expect(minio()).toEqual('minio');
  });
});
