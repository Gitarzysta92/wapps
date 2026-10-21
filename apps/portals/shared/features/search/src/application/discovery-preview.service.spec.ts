import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import {
  DISCOVERY_KINDS,
  type PublicDiscoveryResult,
} from '@domains/discovery';
import {
  PreferencesService,
  PREFERENCES_SESSION,
  type PreferencesState,
} from '@portals/shared/features/preferences';
import {
  DEMO_CATALOG_ENTRIES,
  provideListingFeature,
} from '@portals/shared/features/listing';
import { providePublicDiscovery } from '../public-discovery.providers';
import { DiscoveryPreviewService } from './discovery-preview.service';

function page(total = 3): PublicDiscoveryResult {
  return {
    groups: DISCOVERY_KINDS.map((kind, index) => ({
      kind,
      page: 1,
      pageSize: 3,
      total,
      totalPages: Math.max(1, Math.ceil(total / 3)),
      items: Array.from({ length: Math.min(total, 3) }, (_, entry) => ({
        id: `10000000-0000-4000-8000-0000000000${index}${entry}`,
        revision: 7,
        slug: kind === 'suite' ? null : `${kind}-${entry}`,
        title: `Remote ${kind} ${entry}`,
        summary: 'Service content',
        at: 0,
        categories: ['Work'],
        tags: ['team'],
        tagNames: ['Team collaboration'],
        displayTags: [{ slug: 'team', name: 'Team collaboration' }],
        ...(entry === 0
          ? { classification: 'general' as const }
          : entry === 1
          ? { classification: 'mature' as const }
          : {}),
      })),
    })),
  };
}

describe('API discovery previews', () => {
  let service: DiscoveryPreviewService;
  let http: HttpTestingController;
  let preferences: BehaviorSubject<PreferencesState>;
  let session: BehaviorSubject<string | null>;
  let reload: jest.Mock;
  beforeEach(() => {
    const data = defaultAccountPreferences();
    preferences = new BehaviorSubject<PreferencesState>({
      isLoading: false,
      isError: false,
      data,
      scope: 'guest',
      sessionKey: null,
      sessionVersion: 0,
      context: {
        sessionKey: null,
        sessionVersion: 0,
        read: { data, account: null },
      },
    });
    session = new BehaviorSubject<string | null>(null);
    reload = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideListingFeature({
          mode: 'api',
          apiUrl: 'https://gateway.test',
        }).providers,
        ...providePublicDiscovery('https://gateway.test'),
        {
          provide: PreferencesService,
          useValue: {
            state: () => preferences.value,
            preferences$: preferences,
            reload,
          },
        },
        {
          provide: PREFERENCES_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(DiscoveryPreviewService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function update(patch: Partial<PreferencesState>) {
    preferences.next({ ...preferences.value, ...patch });
  }
  const request = () =>
    http.expectOne(
      (req) => req.url === 'https://gateway.test/api/catalog/discover'
    );

  it('requests one bounded grouped page and preserves canonical IDs, suite destinations and source totals', async () => {
    const data = defaultAccountPreferences();
    data.content.showMatureContent = true;
    update({ data });
    const result = firstValueFrom(service.preview('  Remote   app  '));
    const pending = request();
    expect(pending.request.params.get('search')).toBe('Remote app');
    expect(pending.request.params.get('pageSize')).toBe('3');
    for (const kind of DISCOVERY_KINDS)
      expect(pending.request.params.get(kind + 'Page')).toBe('1');
    pending.flush(page(42));
    const preview = await result;
    expect(preview.total).toBe(126);
    expect(
      preview.groups.map((group) => [
        group.kind,
        group.total,
        group.entries.length,
      ])
    ).toEqual([
      ['applications', 42, 3],
      ['articles', 42, 3],
      ['suites', 42, 3],
    ]);
    expect(preview.groups[0].entries[0]).toMatchObject({
      id: page().groups[0].items[0].id,
      revision: 7,
      slug: 'application-0',
    });
    expect(preview.groups[0].entries[0].rating).toBeUndefined();
    expect(preview.groups[0].entries[0].tags).toEqual([
      { slug: 'team', name: 'Team collaboration' },
    ]);
    expect(preview.groups[2].entries[0].slug).toBe(
      page().groups[2].items[0].id
    );
    http.expectNone(() => true);
  });
  it('never presents matching IDs or slugs as labels when an older source omits display tags', async () => {
    const result = firstValueFrom(service.preview('Remote'));
    const legacy = page();
    for (const group of legacy.groups)
      for (const item of group.items) { delete item.tagNames; delete item.displayTags; }
    request().flush(legacy);
    expect(
      (await result).groups.every((group) =>
        group.entries.every((entry) => entry.tags.length === 0)
      )
    ).toBe(true);
  });
  it('hides Mature and unclassified preview entries for guests without rewriting totals or fetching replacements', async () => {
    const result = firstValueFrom(service.preview('Remote'));
    request().flush(page());
    const preview = await result;
    expect(preview.total).toBe(9);
    expect(
      preview.groups.every(
        (group) => group.entries.length === 1 && group.hiddenCount === 2
      )
    ).toBe(true);
    http.expectNone(() => true);
    const data = defaultAccountPreferences();
    data.content.contentFilters.excludedCategories = ['work'];
    update({ data });
    const excluded = firstValueFrom(service.preview('Remote'));
    request().flush(page());
    expect(
      (await excluded).groups.every(
        (group) =>
          group.entries.length === 0 &&
          group.hiddenCount === 3 &&
          group.total === 3
      )
    ).toBe(true);
  });
  it('does not request blank phrases and distinguishes genuine empty results', async () => {
    expect(await firstValueFrom(service.preview(' \t '))).toEqual({
      search: '',
      total: 0,
      groups: [],
    });
    http.expectNone(() => true);
    const result = firstValueFrom(service.preview('missing'));
    request().flush(page(0));
    expect(await result).toEqual({ search: 'missing', total: 0, groups: [] });
  });
  it('rejects overlong queries without requesting or truncating their meaning', async () => {
    await expect(
      firstValueFrom(service.preview('x'.repeat(101)))
    ).rejects.toThrow('at most 100 characters');
    http.expectNone(() => true);
  });
  it('preserves unavailable and malformed-response failures, then retries without a cached fallback', async () => {
    for (const failure of ['unavailable', 'malformed']) {
      const failed = firstValueFrom(service.preview('Remote'));
      const assertion = expect(failed).rejects.toThrow(
        'temporarily unavailable'
      );
      const pending = request();
      if (failure === 'unavailable')
        pending.flush({}, { status: 503, statusText: 'Unavailable' });
      else pending.flush({ groups: [] });
      await assertion;
    }
    const recovered = firstValueFrom(service.preview('Remote'));
    request().flush(page());
    expect((await recovered).groups).toHaveLength(3);
  });
  it('waits for the current session preferences and exposes an explicit retry on failure', async () => {
    const statuses: string[] = [];
    const watch = service.availability$.subscribe((value) =>
      statuses.push(value.status)
    );
    session.next('Bob');
    await expect(
      firstValueFrom(service.preview('Remote'))
    ).rejects.toMatchObject({ reason: 'loading' });
    http.expectNone(() => true);
    update({
      sessionKey: 'Bob',
      sessionVersion: 1,
      isLoading: false,
      isError: true,
      context: null,
    });
    expect(statuses.at(-1)).toBe('unavailable');
    expect(service.retryPreferences()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    await expect(
      firstValueFrom(service.preview('Remote'))
    ).rejects.toMatchObject({ reason: 'preferences' });
    const data = defaultAccountPreferences();
    update({
      isError: false,
      data,
      context: {
        sessionKey: 'Bob',
        sessionVersion: 1,
        read: { data, account: null },
      },
    });
    expect(statuses.at(-1)).toBe('ready');
    expect(service.retryPreferences()).toBe(false);
    watch.unsubscribe();
  });
  it('invalidates late responses after saved choices change and cancels unsubscribed HTTP work', async () => {
    const result = firstValueFrom(service.preview('Remote'));
    const rejected = expect(result).rejects.toThrow('content choices changed');
    const pending = request();
    const data = defaultAccountPreferences();
    data.content.showMatureContent = true;
    update({ data });
    pending.flush(page());
    await rejected;
    const subscription = service.preview('old').subscribe();
    const cancelled = request();
    subscription.unsubscribe();
    expect(cancelled.cancelled).toBe(true);
  });
  it('emits availability changes for content choices but not unrelated display settings', () => {
    const events: string[] = [];
    const subscription = service.availability$.subscribe((value) =>
      events.push(value.status)
    );
    const data = defaultAccountPreferences();
    data.display.defaultView = 'list';
    update({ data });
    expect(events).toEqual(['ready']);
    const changed = defaultAccountPreferences();
    changed.display.defaultView = 'list';
    changed.content.contentFilters.excludedCategories = ['work'];
    update({ data: changed });
    expect(events).toEqual(['ready', 'ready']);
    subscription.unsubscribe();
  });
});

describe('explicit demo discovery previews', () => {
  it('bounds each supported group while summing complete totals and includes session entries', async () => {
    TestBed.configureTestingModule({
      providers: [
        ...provideListingFeature({ mode: 'demo' }).providers,
        {
          provide: DEMO_CATALOG_ENTRIES,
          useValue: () =>
            ['applications', 'articles', 'suites'].flatMap((kind) =>
              Array.from({ length: 5 }, (_, index) => ({
                kind,
                slug: `sample-${kind}-${index}`,
                name: `Sample ${index}`,
                description: '',
                categories: [],
                tags: [],
              }))
            ),
        },
      ],
    });
    const result = await firstValueFrom(
      TestBed.inject(DiscoveryPreviewService).preview('Sample')
    );
    expect(result.total).toBe(15);
    expect(
      result.groups.map((group) => [
        group.kind,
        group.total,
        group.entries.length,
      ])
    ).toEqual([
      ['applications', 5, 3],
      ['articles', 5, 3],
      ['suites', 5, 3],
    ]);
  });
});
