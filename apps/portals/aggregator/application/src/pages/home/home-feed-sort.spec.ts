import { deserialize, serialize } from 'node:v8';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { DEFAULT_CUSTOMER_PREFERENCES } from '@domains/customer/preferences';
import { CustomerFavoritesDto } from '@domains/customer/favorites';
import { FEED_ITEM_EXAMPLES } from '@portals/shared/data';
import { FEED_PROVIDER_TOKEN } from '@portals/shared/features/feed';
import { PreferencesService } from '@portals/shared/features/preferences';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { HomePageComponent } from './home.component';
import { HomeFeedMetadata, sortHomeFeed } from './home-feed-sort';

const emptyFavorites: CustomerFavoritesDto = { applications: [], suites: [], articles: [], discussions: [] };
const items: HomeFeedMetadata[] = [
  { id: 'recent', timestamp: '2024-03-01', voting: { upvotes: 3, downvotes: 1 }, viewsCount: 100 },
  { id: 'popular', timestamp: '2024-01-01', voting: { upvotes: 20, downvotes: 2 }, viewsCount: 10 },
  { id: 'favorite', timestamp: '2024-02-01', appSlug: 'quick-task', voting: { upvotes: 4, downvotes: 2 }, viewsCount: 200 },
];
const ids = (entries: HomeFeedMetadata[]) => entries.map(entry => entry.id);

describe('home feed sorting', () => {
  it('sorts recent by newest date, without mutating the source', () => {
    expect(ids(sortHomeFeed(items, 'recent', emptyFavorites))).toEqual(['recent', 'favorite', 'popular']);
    expect(ids(items)).toEqual(['recent', 'popular', 'favorite']);
  });
  it('ranks popularity by net votes, then views, then date', () => {
    expect(ids(sortHomeFeed(items, 'popular', emptyFavorites))).toEqual(['popular', 'favorite', 'recent']);
  });
  it('puts explicit favorites before newer or more popular items', () => {
    expect(ids(sortHomeFeed(items, 'recommended', { ...emptyFavorites, applications: ['quick-task'] }))).toEqual(['favorite', 'recent', 'popular']);
  });
  it('uses shared tags only when favorite metadata supplies them', () => {
    const tagged = [...items, { id: 'topic', timestamp: '2023-01-01', tags: [{ slug: 'productivity' }] }];
    const catalog = [{ kind: 'applications' as const, slug: 'quick-task', name: 'Quick Task', description: '', categories: [], tags: [{ slug: 'productivity', name: 'Productivity' }] }];
    expect(ids(sortHomeFeed(tagged, 'recommended', { ...emptyFavorites, applications: ['quick-task'] }, catalog))).toEqual(['favorite', 'topic', 'recent', 'popular']);
    expect(ids(sortHomeFeed(items, 'recommended', emptyFavorites))).toEqual(ids(sortHomeFeed(items, 'recent', emptyFavorites)));
  });
  it('breaks ties deterministically and handles invalid/missing metadata', () => {
    const sparse = [{ id: 'b', timestamp: 'invalid' }, { id: 'a', timestamp: 'invalid' }];
    expect(ids(sortHomeFeed(sparse, 'popular', emptyFavorites))).toEqual(['a', 'b']);
  });
});

describe('saved home feed preferences', () => {
  const originalClone = Object.getOwnPropertyDescriptor(globalThis, 'structuredClone');
  beforeAll(() => {
    if (!originalClone) Object.defineProperty(globalThis, 'structuredClone', {
      configurable: true, value: <T>(value: T): T => deserialize(serialize(value)),
    });
  });
  afterAll(() => {
    if (!originalClone) Reflect.deleteProperty(globalThis, 'structuredClone');
  });
  it('reads saved preferences and favorites per load, returns one finite page, and preserves safe items', async () => {
    const preferences = new BehaviorSubject({ data: structuredClone(DEFAULT_CUSTOMER_PREFERENCES) });
    TestBed.configureTestingModule({ imports: [HomePageComponent], providers: [
      { provide: PreferencesService, useValue: { preferences$: preferences } },
      { provide: MyFavoritesService, useValue: { myFavorites$: of({ data: { ...emptyFavorites, applications: ['quick-task'] } }) } },
    ] });
    TestBed.overrideComponent(HomePageComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(HomePageComponent);
    const provider = fixture.debugElement.injector.get(FEED_PROVIDER_TOKEN);
    const original = JSON.stringify(FEED_ITEM_EXAMPLES);
    let emissions = 0;
    provider.getFeedPage(0, 10).subscribe(result => {
      emissions++;
      expect(result.ok && result.value.items[0].id).toBe('app-review-1');
      expect(result.ok && result.value.hasMore).toBe(false);
    });
    preferences.next({ data: { ...DEFAULT_CUSTOMER_PREFERENCES, content: { ...DEFAULT_CUSTOMER_PREFERENCES.content, feedSortOrder: 'popular' } } });
    expect(emissions).toBe(1);
    const popular = await firstValueFrom(provider.getFeedPage(0, 10));
    expect(popular.ok && popular.value.items[0].id).toBe('discussion-topic-1');
    preferences.next({ data: { ...DEFAULT_CUSTOMER_PREFERENCES, content: { ...DEFAULT_CUSTOMER_PREFERENCES.content, feedSortOrder: 'recommended', showMatureContent: true } } });
    const recommended = await firstValueFrom(provider.getFeedPage(0, 10));
    expect(recommended.ok && recommended.value.items[0].id).toBe('app-teaser-1');
    expect(recommended.ok && recommended.value.items.length).toBe(FEED_ITEM_EXAMPLES.length);
    expect(JSON.stringify(FEED_ITEM_EXAMPLES)).toBe(original);
  });
});
