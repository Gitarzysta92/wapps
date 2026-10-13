import type { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { DiscussionProfileDiscussions } from './public-profile-discussions';
describe('internal profile discussion transport', () => {
  const post = jest.fn();
  const adapter = new DiscussionProfileDiscussions(
    { post } as unknown as HttpService,
    'http://discussion.test',
    'credential'
  );
  beforeEach(() => post.mockReset());
  it('sends owner only in a bounded authenticated internal body, preserving opaque continuation', async () => {
    const page = {
      sharing: 'visible',
      items: [],
      after: 'v1.' + 'a'.repeat(100),
    };
    post.mockReturnValue(of({ data: page }));
    expect(await adapter.read('PrivateOwner', page.after)).toEqual(page);
    expect(post).toHaveBeenCalledWith(
      'http://discussion.test/api/internal/profile-discussions',
      { ownerIdentityId: 'PrivateOwner', after: page.after },
      {
        headers: {
          'x-profile-reader': 'credential',
          Accept: 'application/json',
        },
        timeout: 5000,
        maxRedirects: 0,
        maxContentLength: 128 * 1024,
        maxBodyLength: 2048,
      }
    );
  });
  it('rejects private fields, malformed/hidden payloads and failed dependencies', async () => {
    for (const value of [
      { sharing: 'hidden', items: [], after: null },
      {
        sharing: 'visible',
        items: [],
        after: null,
        ownerIdentityId: 'PrivateOwner',
      },
      { sharing: 'visible', items: [], after: 'PrivateOwner' },
    ]) {
      post.mockReturnValue(of({ data: value }));
      await expect(adapter.read('PrivateOwner', null)).rejects.toThrow(
        'unavailable'
      );
    }
    post.mockReturnValue(
      throwError(() => new Error('private network diagnostic'))
    );
    await expect(adapter.read('PrivateOwner', null)).rejects.toThrow(
      'Shared discussion content unavailable'
    );
  });
});
