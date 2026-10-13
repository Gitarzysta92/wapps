import type { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { PublicFavoriteTargets } from './public-favorite-targets';

const id = '10000000-0000-4000-8000-000000000001';
const item = {
  id,
  applicationId: id,
  revision: 2,
  title: 'Current topic',
  replyCount: 3,
};
describe('owning-service favorite eligibility', () => {
  const get = jest.fn();
  const targets = new PublicFavoriteTargets(
    { get } as unknown as HttpService,
    'http://editorial.test',
    'http://discussion.test'
  );
  beforeEach(() => get.mockReset());
  it('uses bounded unsigned Discussion transport and validates the requested identity', async () => {
    get.mockReturnValue(of({ data: { items: [item] } }));
    expect(await targets.available({ kind: 'discussions', id })).toBe(true);
    expect(get).toHaveBeenCalledWith(
      'http://discussion.test/api/discussion-selection',
      {
        params: { ids: id },
        timeout: 5000,
        maxRedirects: 0,
        maxContentLength: 1024 * 1024,
        headers: { Accept: 'application/json' },
      }
    );
    get.mockReturnValue(of({ data: { items: [] } }));
    expect(await targets.available({ kind: 'discussions', id })).toBe(false);
  });
  it('fails closed on malformed/private metadata and target outages or projection lag', async () => {
    for (const result of [
      of({ data: { items: [{ ...item, ownerIdentityId: 'private' }] } }),
      of({
        data: {
          items: [{ ...item, id: '10000000-0000-4000-8000-000000000002' }],
        },
      }),
      of({ data: { items: [item, item] } }),
      throwError(() => ({ response: { status: 503 } })),
      throwError(() => new Error('network failure')),
    ]) {
      get.mockReturnValue(result);
      await expect(
        targets.available({ kind: 'discussions', id })
      ).rejects.toThrow('lookup unavailable');
    }
  });
  it('delegates Editorial targets without querying Discussion', async () => {
    for (const kind of ['applications', 'suites', 'articles'] as const) {
      get.mockReturnValue(of({ data: { items: [] } }));
      expect(await targets.available({ kind, id })).toBe(false);
      expect(get.mock.calls[get.mock.calls.length - 1][0]).toMatch(
        /^http:\/\/editorial.test\/api\/catalog\//
      );
    }
  });
  it.each([
    'file:///tmp/x',
    'http://a:b@discussion',
    'http://discussion/api',
    'http://discussion/?tenant=other',
  ])('rejects unsafe Discussion origin %s', (origin) => {
    expect(
      () =>
        new PublicFavoriteTargets(
          { get } as unknown as HttpService,
          'http://editorial.test',
          origin
        )
    ).toThrow();
  });
});
