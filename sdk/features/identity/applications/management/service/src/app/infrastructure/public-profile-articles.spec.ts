import type { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { EditorialProfileArticles } from './public-profile-articles';

const id = '00000000-0000-4000-8000-000000000001';
const page = {
  sharing: 'visible',
  items: [
    {
      id,
      title: 'Public article',
      excerpt: '',
      slug: 'published-article',
      publishedAt: 1,
    },
  ],
  after: null,
};
describe('internal profile article HTTP adapter', () => {
  const post = jest.fn();
  const adapter = new EditorialProfileArticles(
    { post } as unknown as HttpService,
    'http://editorial.test',
    'test-credential'
  );
  beforeEach(() => post.mockReset());
  it('keeps private owner IDs in a bounded internal body, authenticates the service and disables redirects', async () => {
    post.mockReturnValue(of({ data: page }));
    expect(await adapter.read('OwnerUid', null)).toEqual(page);
    expect(post).toHaveBeenCalledWith(
      'http://editorial.test/api/internal/profile-articles',
      { ownerIdentityId: 'OwnerUid', after: null },
      {
        headers: {
          'x-profile-reader': 'test-credential',
          Accept: 'application/json',
        },
        timeout: 5000,
        maxRedirects: 0,
        maxContentLength: 128 * 1024,
        maxBodyLength: 2048,
      }
    );
  });
  it('fails closed on scope leakage, hidden upstream data, invalid continuation and dependency failure', async () => {
    for (const result of [
      of({ data: { ...page, ownerIdentityId: 'OwnerUid' } }),
      of({ data: { sharing: 'hidden', items: [], after: null } }),
      throwError(() => new Error('private network diagnostic')),
    ]) {
      post.mockReturnValue(result);
      await expect(adapter.read('OwnerUid', null)).rejects.toThrow(
        'Shared article content unavailable'
      );
    }
    post.mockReturnValue(of({ data: page }));
    await expect(adapter.read('OwnerUid', id)).rejects.toThrow('unavailable');
  });
  it.each([
    'file:///tmp/items',
    'http://user:password@editorial.test',
    'http://editorial.test/api',
    'http://editorial.test/?scope=other',
  ])('rejects unsafe configured origin %s', (origin) => {
    expect(
      () =>
        new EditorialProfileArticles(
          { post } as unknown as HttpService,
          origin,
          'credential'
        )
    ).toThrow();
  });
});
