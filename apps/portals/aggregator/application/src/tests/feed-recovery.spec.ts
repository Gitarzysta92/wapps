import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { NewsFeedService } from '@portals/shared/features/feed';
import { FEED_PROVIDER_TOKEN, IFeedPage } from '../../../../shared/features/feed/src/presentation/ports/feed-provider.port';
import { Result } from '@foundation/standard';

// Retry must keep the same page, preserve visible items and release the loading state.
describe('feed recovery', () => {
  const provider = { getFeedPage: jest.fn() };
  const item = { id: 'first', type: 'test', timestamp: new Date() };
  beforeEach(() => {
    provider.getFeedPage.mockReset();
    TestBed.configureTestingModule({ providers: [NewsFeedService, { provide: FEED_PROVIDER_TOKEN, useValue: provider }] });
  });

  it('retries a failed page without discarding items or skipping pagination', async () => {
    provider.getFeedPage
      .mockReturnValueOnce(of({ ok: true, value: { items: [item], hasMore: true } }))
      .mockReturnValueOnce(of({ ok: false, error: new Error('Unavailable') }))
      .mockReturnValueOnce(of({ ok: true, value: { items: [{ ...item, id: 'second' }], hasMore: false } }));
    const feed = TestBed.inject(NewsFeedService);
    feed.loadNextPage(); feed.loadNextPage();
    expect(await firstValueFrom(feed.error$)).toBe(true);
    expect(await firstValueFrom(feed.loading$)).toBe(false);
    expect(await firstValueFrom(feed.feedItems$)).toEqual([item]);
    feed.loadNextPage();
    expect(provider.getFeedPage.mock.calls.map(args => args[0])).toEqual([0, 1, 1]);
    expect(await firstValueFrom(feed.error$)).toBe(false);
    expect((await firstValueFrom(feed.feedItems$)).map(item => item.id)).toEqual(['first', 'second']);
    feed.loadNextPage();
    expect(provider.getFeedPage).toHaveBeenCalledTimes(3);
  });

  it('recovers from a thrown request error and distinguishes an empty successful feed', async () => {
    provider.getFeedPage.mockReturnValueOnce(throwError(() => new Error('Offline')))
      .mockReturnValueOnce(of({ ok: true, value: { items: [], hasMore: false } }));
    const feed = TestBed.inject(NewsFeedService);
    feed.loadNextPage();
    expect(await firstValueFrom(feed.error$)).toBe(true);
    expect(await firstValueFrom(feed.loading$)).toBe(false);
    feed.loadNextPage();
    expect(await firstValueFrom(feed.error$)).toBe(false);
    expect(await firstValueFrom(feed.loaded$)).toBe(true);
    expect(await firstValueFrom(feed.feedItems$)).toEqual([]);
  });

  it('ignores stale results after refreshing while a request is pending', async () => {
    const pending = new Subject<Result<IFeedPage, Error>>();
    provider.getFeedPage.mockReturnValueOnce(pending)
      .mockReturnValueOnce(of({ ok: true, value: { items: [], hasMore: false } }));
    const feed = TestBed.inject(NewsFeedService);
    feed.loadNextPage(); feed.refresh();
    pending.next({ ok: true, value: { items: [item], hasMore: true } });
    expect(await firstValueFrom(feed.feedItems$)).toEqual([]);
    expect(await firstValueFrom(feed.loading$)).toBe(false);
    expect(await firstValueFrom(feed.hasMore$)).toBe(false);
  });
});
