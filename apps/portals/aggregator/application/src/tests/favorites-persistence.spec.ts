import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MyFavoritesApiService, MyFavoritesService, MY_FAVORITES_STATE_PROVIDER, provideMyFavoritesFeature } from '@portals/shared/features/my-favorites';

const key = 'wapps.favorites.v1';

describe('local favorites', () => {
  beforeEach(() => {
    localStorage.removeItem(key);
    TestBed.configureTestingModule({ providers: [MyFavoritesApiService, ...provideMyFavoritesFeature({ apiBaseUrl: '' }).providers] });
  });
  afterEach(() => localStorage.removeItem(key));

  it('keeps an added item after a new adapter is created and removes it durably', async () => {
    const adapter = TestBed.inject(MyFavoritesApiService);
    await firstValueFrom(adapter.addToFavorites('articles', 'tech-trends-2024'));
    await firstValueFrom(adapter.addToFavorites('articles', 'tech-trends-2024'));
    const restored = TestBed.runInInjectionContext(() => new MyFavoritesApiService());
    const saved = await firstValueFrom(restored.getMyFavorites());
    expect(saved.ok && saved.value.articles).toEqual(['tech-trends-2024']);
    await firstValueFrom(restored.removeFromFavorites('articles', 'tech-trends-2024'));
    const reloaded = TestBed.runInInjectionContext(() => new MyFavoritesApiService());
    const removed = await firstValueFrom(reloaded.getMyFavorites());
    expect(removed.ok && removed.value.articles).toEqual([]);
  });

  it('shares one state service between buttons and sidebar consumers', () => {
    expect(TestBed.inject(MY_FAVORITES_STATE_PROVIDER)).toBe(TestBed.inject(MyFavoritesService));
  });

  it('recovers from corrupt storage and ignores invalid array members', async () => {
    localStorage.setItem(key, '{broken');
    const adapter = TestBed.runInInjectionContext(() => new MyFavoritesApiService());
    expect((await firstValueFrom(adapter.getMyFavorites())).ok).toBe(true);
    localStorage.setItem(key, JSON.stringify({ articles: ['safe-slug', 99, null, 'safe-slug'] }));
    const recovered = TestBed.runInInjectionContext(() => new MyFavoritesApiService());
    const result = await firstValueFrom(recovered.getMyFavorites());
    expect(result.ok && result.value.articles).toEqual(['safe-slug']);
  });

  it('reports a storage failure without pretending the item was saved', async () => {
    const adapter = TestBed.inject(MyFavoritesApiService);
    const before = await firstValueFrom(adapter.getMyFavorites());
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('Storage full'); };
    try {
      const result = await firstValueFrom(adapter.addToFavorites('articles', 'new-article'));
      expect(result.ok).toBe(false);
      expect(await firstValueFrom(adapter.getMyFavorites())).toEqual(before);
    } finally { Storage.prototype.setItem = original; }
  });
});
