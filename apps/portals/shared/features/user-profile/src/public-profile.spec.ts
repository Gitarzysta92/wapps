import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  PUBLIC_PROFILE_API_URL,
  PUBLIC_PROFILE_PORT,
  PUBLIC_PROFILE_SESSION,
  PublicProfileError,
} from './application/public-profile.port';
import { PublicProfileApiService } from './infrastructure/public-profile-api.service';
import { PublicProfileService } from './application/public-profile.service';

const ownerId = '00000000-0000-4000-8000-000000000001';
const requesterId = '00000000-0000-4000-8000-000000000002';
const follow = { ownerId, requesterId, revision: 0, status: 'none' as const };
const restricted = {
  view: { access: 'followers', profile: null, isOwner: false, follow },
  profile: null,
};
const visible = {
  view: { access: 'visible' as const, profile: null, isOwner: false, follow },
  profile: { id: ownerId, name: 'Alice' },
};
const favorite = {
  kind: 'applications',
  id: requesterId,
  title: 'Shared app',
  slug: 'shared-app',
  applicationSlug: null,
};
const favoritesPage = { sharing: 'visible', items: [favorite], after: null };
const discussion = {
  id: requesterId,
  parentKind: 'article',
  parentId: ownerId,
  parentSlug: 'shared-article',
  title: 'Shared article',
  createdAt: 100,
  replyCount: 1,
  participation: 'participant',
};
const discussionsPage = {
  sharing: 'visible',
  items: [discussion],
  after: null,
};
const discussionCursor = `v1.${'a'.repeat(80)}`;
const activityCursor = `a1.${'a'.repeat(80)}`;
const activity = {
  kind: 'reply',
  id: requesterId,
  at: 100,
  title: 'A public contribution',
  target: { kind: 'discussion', id: ownerId, applicationSlug: 'shared-app' },
};
const activityPage = {
  sharing: 'visible',
  items: [activity],
  after: activityCursor,
};

describe('public profile session and command state', () => {
  function fixture() {
    const session = new BehaviorSubject<string | null>('member');
    const port = {
      activity: jest
        .fn()
        .mockReturnValue(of(ok({ sharing: 'hidden', items: [], after: null }))),
      discussions: jest
        .fn()
        .mockReturnValue(of(ok({ sharing: 'hidden', items: [], after: null }))),
      articles: jest
        .fn()
        .mockReturnValue(of(ok({ sharing: 'hidden', items: [], after: null }))),
      suites: jest
        .fn()
        .mockReturnValue(of(ok({ sharing: 'hidden', items: [], after: null }))),
      favorites: jest
        .fn()
        .mockReturnValue(of(ok({ sharing: 'hidden', items: [], after: null }))),
      read: jest.fn().mockReturnValue(of(ok(restricted))),
      directory: jest
        .fn()
        .mockReturnValue(of(ok({ profiles: [], after: null }))),
      followers: jest
        .fn()
        .mockReturnValue(of(ok({ followers: [], after: null }))),
      following: jest
        .fn()
        .mockReturnValue(of(ok({ following: [], after: null }))),
      change: jest
        .fn()
        .mockReturnValue(
          of(err(new PublicProfileError('unavailable', 'Unknown result')))
        ),
      releasePhoto: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        PublicProfileService,
        { provide: PUBLIC_PROFILE_PORT, useValue: port },
        {
          provide: PUBLIC_PROFILE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    return { session, port, service: TestBed.inject(PublicProfileService) };
  }
  afterEach(() => TestBed.resetTestingModule());
  it('loads activity only for readable profiles and clears old entries before pagination, failure and retry', () => {
    const f = fixture();
    f.service.open(ownerId);
    expect(f.port.activity).not.toHaveBeenCalled();
    f.port.read.mockReturnValue(of(ok(visible)));
    f.service.reload();
    expect(f.service.activity()).toEqual({
      sharing: 'hidden',
      items: [],
      after: null,
    });
    f.port.activity.mockReturnValue(of(ok(activityPage)));
    f.service.loadActivity();
    expect(f.service.activity()).toEqual(activityPage);
    const pending = new Subject();
    f.port.activity.mockReturnValue(pending);
    f.service.loadActivity(activityCursor);
    expect(f.port.activity).toHaveBeenLastCalledWith(ownerId, activityCursor);
    expect(f.service.activity()).toBeNull();
    expect(f.service.activityStatus()).toBe('loading');
    pending.next(err(new PublicProfileError('unavailable', 'Offline')));
    expect(f.service.activityStatus()).toBe('unavailable');
    expect(f.service.activity()).toBeNull();
    const emptyPage = { sharing: 'visible', items: [], after: activityCursor };
    f.port.activity.mockReturnValue(of(ok(emptyPage)));
    f.service.loadActivity();
    expect(f.service.activityStatus()).toBe('ready');
    expect(f.service.activity()).toEqual(emptyPage);
  });
  it.each(['session', 'route', 'reload', 'destroy'])(
    'discards pending activity on %s changes',
    (action) => {
      const f = fixture();
      const pending = new Subject();
      f.port.activity.mockReturnValue(pending);
      f.port.read.mockReturnValue(of(ok(visible)));
      f.service.open(ownerId);
      expect(pending.observed).toBe(true);
      f.port.read.mockReturnValue(of(ok(restricted)));
      if (action === 'session') f.session.next(null);
      else if (action === 'route') f.service.open(requesterId);
      else if (action === 'reload') f.service.reload();
      else TestBed.resetTestingModule();
      expect(pending.observed).toBe(false);
      pending.next(ok(activityPage));
      expect(f.service.activity()).toBeNull();
      expect(f.port.activity).toHaveBeenCalledTimes(1);
    }
  );
  it('loads participation only for readable profiles and clears old results before page reads and retries', () => {
    const f = fixture();
    f.service.open(ownerId);
    expect(f.port.discussions).not.toHaveBeenCalled();
    f.port.read.mockReturnValue(of(ok(visible)));
    f.service.reload();
    expect(f.service.discussions()?.sharing).toBe('hidden');
    f.port.discussions.mockReturnValue(of(ok(discussionsPage)));
    f.service.loadDiscussions();
    expect(f.service.discussions()).toEqual(discussionsPage);
    const pending = new Subject();
    f.port.discussions.mockReturnValue(pending);
    f.service.loadDiscussions(discussionCursor);
    expect(f.port.discussions).toHaveBeenLastCalledWith(
      ownerId,
      discussionCursor
    );
    expect(f.service.discussions()).toBeNull();
    expect(f.service.discussionsStatus()).toBe('loading');
    pending.next(err(new PublicProfileError('unavailable', 'Offline')));
    expect(f.service.discussionsStatus()).toBe('unavailable');
    expect(f.service.discussions()).toBeNull();
    const emptyPage = {
      sharing: 'visible',
      items: [],
      after: discussionCursor,
    };
    f.port.discussions.mockReturnValue(of(ok(emptyPage)));
    f.service.loadDiscussions();
    expect(f.service.discussionsStatus()).toBe('ready');
    expect(f.service.discussions()).toEqual(emptyPage);
  });
  it.each(['session', 'route', 'reload', 'destroy'])(
    'discards pending participation on %s changes',
    (action) => {
      const f = fixture();
      const pending = new Subject();
      f.port.discussions.mockReturnValue(pending);
      f.port.read.mockReturnValue(of(ok(visible)));
      f.service.open(ownerId);
      expect(pending.observed).toBe(true);
      f.port.read.mockReturnValue(of(ok(restricted)));
      if (action === 'session') f.session.next(null);
      else if (action === 'route') f.service.open(requesterId);
      else if (action === 'reload') f.service.reload();
      else TestBed.resetTestingModule();
      expect(pending.observed).toBe(false);
      pending.next(ok(discussionsPage));
      expect(f.service.discussions()).toBeNull();
      expect(f.port.discussions).toHaveBeenCalledTimes(1);
    }
  );
  it('loads published articles only for readable profiles and clears stale content before retry/page reads', () => {
    const f = fixture();
    f.service.open(ownerId);
    expect(f.port.articles).not.toHaveBeenCalled();
    f.port.read.mockReturnValue(of(ok(visible)));
    f.service.reload();
    expect(f.service.articles()).toEqual({
      sharing: 'hidden',
      items: [],
      after: null,
    });
    const page = {
      sharing: 'visible',
      items: [
        {
          id: requesterId,
          title: 'Public article',
          excerpt: '',
          slug: 'published-article',
          publishedAt: 1,
        },
      ],
      after: null,
    };
    f.port.articles.mockReturnValue(of(ok(page)));
    f.service.loadArticles();
    expect(f.service.articles()).toEqual(page);
    const pending = new Subject();
    f.port.articles.mockReturnValue(pending);
    f.service.loadArticles(requesterId);
    expect(f.port.articles).toHaveBeenLastCalledWith(ownerId, requesterId);
    expect(f.service.articles()).toBeNull();
    expect(f.service.articlesStatus()).toBe('loading');
    pending.next(err(new PublicProfileError('unavailable', 'Offline')));
    expect(f.service.articlesStatus()).toBe('unavailable');
    expect(f.service.articles()).toBeNull();
    f.port.articles.mockReturnValue(
      of(ok({ sharing: 'visible', items: [], after: null }))
    );
    f.service.loadArticles();
    expect(f.service.articlesStatus()).toBe('ready');
    expect(f.service.articles()?.sharing).toBe('visible');
  });
  it.each(['session', 'route', 'reload', 'destroy'])(
    'discards pending articles on %s changes',
    (action) => {
      const f = fixture();
      const pending = new Subject();
      f.port.articles.mockReturnValue(pending);
      f.port.read.mockReturnValue(of(ok(visible)));
      f.service.open(ownerId);
      expect(pending.observed).toBe(true);
      f.port.read.mockReturnValue(of(ok(restricted)));
      if (action === 'session') f.session.next(null);
      else if (action === 'route') f.service.open(requesterId);
      else if (action === 'reload') f.service.reload();
      else TestBed.resetTestingModule();
      expect(pending.observed).toBe(false);
      pending.next(ok({ sharing: 'visible', items: [], after: null }));
      expect(f.service.articles()).toBeNull();
    }
  );
  it('loads published suites only for readable profiles and clears stale content before retry/page reads', () => {
    const f = fixture();
    f.service.open(ownerId);
    expect(f.port.suites).not.toHaveBeenCalled();
    f.port.read.mockReturnValue(of(ok(visible)));
    f.service.reload();
    expect(f.service.suites()).toEqual({
      sharing: 'hidden',
      items: [],
      after: null,
    });
    const page = {
      sharing: 'visible',
      items: [{ id: requesterId, title: 'Public suite', description: '' }],
      after: null,
    };
    f.port.suites.mockReturnValue(of(ok(page)));
    f.service.loadSuites();
    expect(f.service.suites()).toEqual(page);
    const pending = new Subject();
    f.port.suites.mockReturnValue(pending);
    f.service.loadSuites(requesterId);
    expect(f.port.suites).toHaveBeenLastCalledWith(ownerId, requesterId);
    expect(f.service.suites()).toBeNull();
    expect(f.service.suitesStatus()).toBe('loading');
    pending.next(err(new PublicProfileError('unavailable', 'Offline')));
    expect(f.service.suitesStatus()).toBe('unavailable');
    expect(f.service.suites()).toBeNull();
    f.port.suites.mockReturnValue(
      of(ok({ sharing: 'visible', items: [], after: null }))
    );
    f.service.loadSuites();
    expect(f.service.suitesStatus()).toBe('ready');
    expect(f.service.suites()?.sharing).toBe('visible');
  });
  it.each(['session', 'route', 'reload', 'destroy'])(
    'discards pending suites on %s changes',
    (action) => {
      const f = fixture();
      const pending = new Subject();
      f.port.suites.mockReturnValue(pending);
      f.port.read.mockReturnValue(of(ok(visible)));
      f.service.open(ownerId);
      expect(pending.observed).toBe(true);
      f.port.read.mockReturnValue(of(ok(restricted)));
      if (action === 'session') f.session.next(null);
      else if (action === 'route') f.service.open(requesterId);
      else if (action === 'reload') f.service.reload();
      else TestBed.resetTestingModule();
      expect(pending.observed).toBe(false);
      pending.next(ok({ sharing: 'visible', items: [], after: null }));
      expect(f.service.suites()).toBeNull();
    }
  );
  it('retains exact uncertain intent and refuses a different action until resolved', () => {
    const f = fixture();
    f.service.open(ownerId);
    f.service.change(follow, 'request');
    expect(f.service.uncertain()).toBe(true);
    f.service.change(follow, 'cancel');
    expect(f.port.change).toHaveBeenCalledTimes(1);
    f.service.retry();
    expect(f.port.change.mock.calls[1]).toEqual(f.port.change.mock.calls[0]);
  });
  it('requires explicit reload after a stale revision and creates no automatic replacement command', () => {
    const f = fixture();
    f.service.open(ownerId);
    f.port.change.mockReturnValue(
      of(err(new PublicProfileError('conflict', 'Reload')))
    );
    f.service.change(follow, 'request');
    f.service.retry();
    expect(f.service.conflict()).toBe(true);
    expect(f.port.change).toHaveBeenCalledTimes(1);
    f.service.reload();
    expect(f.service.conflict()).toBe(false);
  });
  it('cancels old reads and write receipts and drops retry intent on account change', () => {
    const f = fixture();
    const response = new Subject();
    f.port.change.mockReturnValue(response);
    f.service.open(ownerId);
    f.service.change(follow, 'request');
    f.session.next(null);
    expect(response.observed).toBe(false);
    expect(f.service.signedIn()).toBe(false);
    expect(f.service.saving()).toBe(false);
    f.service.retry();
    expect(f.port.change).toHaveBeenCalledTimes(1);
    expect(f.port.releasePhoto).toHaveBeenCalled();
  });
  it('discards old payloads on a failing refresh and never substitutes demo data', () => {
    const f = fixture();
    f.service.open(ownerId);
    f.port.read.mockReturnValue(
      of(err(new PublicProfileError('unavailable', 'Offline')))
    );
    f.service.reload();
    expect(f.service.status()).toBe('unavailable');
    expect(f.service.profile()).toBeNull();
  });
  it('loads both owner approval and outgoing cancellation lists only for an owner preview', () => {
    const f = fixture();
    f.service.open(ownerId);
    expect(f.port.followers).not.toHaveBeenCalled();
    f.port.read.mockReturnValue(
      of(ok({ ...restricted, view: { ...restricted.view, isOwner: true } }))
    );
    f.service.reload();
    expect(f.port.followers).toHaveBeenCalledWith(null);
    expect(f.port.following).toHaveBeenCalledWith(null);
  });
  it('loads favorites only after a readable profile and preserves hidden versus empty states', () => {
    const f = fixture();
    f.service.open(ownerId);
    expect(f.port.favorites).not.toHaveBeenCalled();
    f.port.read.mockReturnValue(of(ok(visible)));
    f.service.reload();
    expect(f.port.favorites).toHaveBeenCalledWith(ownerId, null);
    expect(f.service.favorites()).toEqual({
      sharing: 'hidden',
      items: [],
      after: null,
    });
    f.port.favorites.mockReturnValue(
      of(ok({ sharing: 'visible', items: [], after: null }))
    );
    f.service.loadFavorites();
    expect(f.service.favorites()?.sharing).toBe('visible');
    expect(f.service.favoritesStatus()).toBe('ready');
  });
  it('clears previous content while paging and reports dependency failure before retrying', () => {
    const f = fixture();
    f.port.read.mockReturnValue(of(ok(visible)));
    f.port.favorites.mockReturnValue(of(ok(favoritesPage)));
    f.service.open(ownerId);
    const pending = new Subject();
    f.port.favorites.mockReturnValue(pending);
    const cursor = `applications:${requesterId}`;
    f.service.loadFavorites(cursor);
    expect(f.port.favorites).toHaveBeenLastCalledWith(ownerId, cursor);
    expect(f.service.favorites()).toBeNull();
    expect(f.service.favoritesStatus()).toBe('loading');
    pending.next(err(new PublicProfileError('unavailable', 'Offline')));
    expect(f.service.favoritesStatus()).toBe('unavailable');
    expect(f.service.favorites()).toBeNull();
    f.port.favorites.mockReturnValue(of(ok(favoritesPage)));
    f.service.loadFavorites();
    expect(f.service.favorites()).toEqual(favoritesPage);
  });
  it.each(['session', 'route', 'reload', 'destroy'])(
    'cancels pending favorites on %s changes',
    (action) => {
      const f = fixture();
      const pending = new Subject();
      f.port.read.mockReturnValue(of(ok(visible)));
      f.port.favorites.mockReturnValue(pending);
      f.service.open(ownerId);
      expect(pending.observed).toBe(true);
      f.port.read.mockReturnValue(of(ok(restricted)));
      if (action === 'session') f.session.next(null);
      else if (action === 'route') f.service.open(requesterId);
      else if (action === 'reload') f.service.reload();
      else TestBed.resetTestingModule();
      expect(pending.observed).toBe(false);
      pending.next(ok(favoritesPage));
      expect(f.service.favorites()).toBeNull();
      expect(f.port.favorites).toHaveBeenCalledTimes(1);
    }
  );
});

describe('public profile HTTP adapter', () => {
  let http: HttpTestingController;
  let adapter: PublicProfileApiService;
  const source = {
    id: ownerId,
    name: 'Alice',
    bio: null,
    location: null,
    socialLinks: {},
    avatarId: requesterId,
    registeredAt: 100,
  };
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:profile'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PublicProfileApiService,
        { provide: PUBLIC_PROFILE_API_URL, useValue: '' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    adapter = TestBed.inject(PublicProfileApiService);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });
  it('loads article parsing lazily, binds the cursor and cancels obsolete HTTP', fakeAsync(() => {
    const result = jest.fn();
    const canceled = adapter.articles(ownerId, null).subscribe(result);
    canceled.unsubscribe();
    flushMicrotasks();
    http.expectNone(`/api/profiles/${ownerId}/articles`);
    const active = adapter.articles(ownerId, requesterId).subscribe(result);
    flushMicrotasks();
    const request = http.expectOne(
      (req) => req.url === `/api/profiles/${ownerId}/articles`
    );
    expect(request.request.params.get('after')).toBe(requesterId);
    active.unsubscribe();
    expect(request.cancelled).toBe(true);
    expect(result).not.toHaveBeenCalled();
  }));
  it('rejects private article fields and backwards continuation', fakeAsync(() => {
    const item = {
      id: requesterId,
      title: 'Published',
      slug: 'published',
      excerpt: '',
      publishedAt: 100,
    };
    for (const [after, value] of [
      [
        null,
        {
          sharing: 'visible',
          items: [{ ...item, ownerIdentityId: 'Private' }],
          after: null,
        },
      ],
      [requesterId, { sharing: 'visible', items: [item], after: null }],
    ] as const) {
      const result = jest.fn();
      adapter.articles(ownerId, after).subscribe(result);
      flushMicrotasks();
      http
        .expectOne((req) => req.url === `/api/profiles/${ownerId}/articles`)
        .flush(value);
      expect(result.mock.calls[0][0].ok).toBe(false);
    }
  }));
  it('loads the activity contract lazily and sends only its opaque continuation', fakeAsync(() => {
    const result = jest.fn();
    adapter.activity(ownerId, activityCursor).subscribe(result);
    flushMicrotasks();
    const request = http.expectOne(
      (req) => req.url === `/api/profiles/${ownerId}/activity`
    );
    expect(request.request.params.keys()).toEqual(['after']);
    expect(request.request.params.get('after')).toBe(activityCursor);
    expect(request.request.headers.keys()).toEqual([]);
    request.flush(activityPage);
    expect(result).toHaveBeenCalledWith(ok(activityPage));
  }));
  it('cancels activity contract loading and pending HTTP on unsubscribe', fakeAsync(() => {
    const result = jest.fn();
    const first = adapter.activity(ownerId, null).subscribe(result);
    first.unsubscribe();
    flushMicrotasks();
    http.expectNone(`/api/profiles/${ownerId}/activity`);
    const second = adapter.activity(ownerId, null).subscribe(result);
    flushMicrotasks();
    const request = http.expectOne(`/api/profiles/${ownerId}/activity`);
    second.unsubscribe();
    expect(request.cancelled).toBe(true);
    expect(result).not.toHaveBeenCalled();
  }));
  it.each([
    { ...activityPage, ownerIdentityId: 'PrivateUid' },
    { ...activityPage, sharing: 'hidden' },
    {
      ...activityPage,
      items: [
        {
          ...activity,
          target: { ...activity.target, applicationSlug: '../private' },
        },
      ],
    },
    { ...activityPage, items: [{ ...activity, identityId: 'PrivateUid' }] },
    { ...activityPage, after: `100.${requesterId}` },
    { ...activityPage, items: [activity, activity] },
  ])('rejects malformed or private activity summaries: %j', (value) => {
    fakeAsync(() => {
      const result = jest.fn();
      adapter.activity(ownerId, null).subscribe(result);
      flushMicrotasks();
      http.expectOne(`/api/profiles/${ownerId}/activity`).flush(value);
      expect(result).toHaveBeenCalledWith(
        err(expect.objectContaining({ reason: 'unavailable' }))
      );
    })();
  });
  it('loads the discussion contract lazily and sends only the opaque public cursor', fakeAsync(() => {
    const result = jest.fn();
    adapter.discussions(ownerId, discussionCursor).subscribe(result);
    flushMicrotasks();
    const request = http.expectOne(
      (req) => req.url === `/api/profiles/${ownerId}/discussions`
    );
    expect(request.request.params.keys()).toEqual(['after']);
    expect(request.request.params.get('after')).toBe(discussionCursor);
    expect(request.request.headers.keys()).toEqual([]);
    request.flush(discussionsPage);
    expect(result).toHaveBeenCalledWith(ok(discussionsPage));
  }));
  it('cancels discussion reads while their contract loads and while HTTP is pending', fakeAsync(() => {
    const result = jest.fn();
    const first = adapter.discussions(ownerId, null).subscribe(result);
    first.unsubscribe();
    flushMicrotasks();
    http.expectNone(`/api/profiles/${ownerId}/discussions`);
    const second = adapter.discussions(ownerId, null).subscribe(result);
    flushMicrotasks();
    const request = http.expectOne(`/api/profiles/${ownerId}/discussions`);
    second.unsubscribe();
    expect(request.cancelled).toBe(true);
    expect(result).not.toHaveBeenCalled();
  }));
  it.each([
    { ...discussionsPage, ownerIdentityId: 'PrivateUid' },
    { ...discussionsPage, sharing: 'hidden' },
    {
      ...discussionsPage,
      items: [{ ...discussion, parentSlug: '../private' }],
    },
    { ...discussionsPage, items: [{ ...discussion, contributedAt: 100 }] },
    { ...discussionsPage, after: `100.${requesterId}` },
  ])('rejects malformed discussion summaries: %j', (value) => {
    fakeAsync(() => {
      const result = jest.fn();
      adapter.discussions(ownerId, null).subscribe(result);
      flushMicrotasks();
      http.expectOne(`/api/profiles/${ownerId}/discussions`).flush(value);
      expect(result).toHaveBeenCalledWith(
        err(expect.objectContaining({ reason: 'unavailable' }))
      );
    })();
  });
  it('requests suites using only public profile/cursor identifiers and rejects private upstream fields', () => {
    const result = jest.fn();
    adapter.suites(ownerId, null).subscribe(result);
    http
      .expectOne(`/api/profiles/${ownerId}/suites`)
      .flush({ sharing: 'hidden', items: [], after: null });
    expect(result).toHaveBeenCalledWith(
      ok({ sharing: 'hidden', items: [], after: null })
    );
    adapter.suites(ownerId, requesterId).subscribe(result);
    const request = http.expectOne(
      (req) => req.url === `/api/profiles/${ownerId}/suites`
    );
    expect(request.request.params.keys()).toEqual(['after']);
    expect(request.request.params.get('after')).toBe(requesterId);
    request.flush({
      sharing: 'visible',
      ownerIdentityId: 'PrivateUid',
      items: [],
      after: null,
    });
    expect(result).toHaveBeenLastCalledWith(
      err(expect.objectContaining({ reason: 'unavailable' }))
    );
  });
  it('fetches audience-protected bytes without tokens in URLs and revokes the object URL', () => {
    const result = jest.fn();
    adapter.read(ownerId).subscribe(result);
    http
      .expectOne(`/api/profiles/${ownerId}`)
      .flush({ access: 'visible', isOwner: false, profile: source, follow });
    expect(result).not.toHaveBeenCalled();
    http
      .expectOne(`/api/profiles/${ownerId}/avatar/${requesterId}`)
      .flush(new Blob(['RIFF0123WEBP0'], { type: 'image/webp' }));
    expect(result).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          profile: expect.objectContaining({
            avatar: { uri: 'blob:profile', alt: 'Alice' },
          }),
        }),
      })
    );
    adapter.releasePhoto();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile');
  });
  it('withholds profile text if its photo read is denied after a visibility change', () => {
    const result = jest.fn();
    adapter.read(ownerId).subscribe(result);
    http
      .expectOne(`/api/profiles/${ownerId}`)
      .flush({ access: 'visible', isOwner: false, profile: source, follow });
    http
      .expectOne(`/api/profiles/${ownerId}/avatar/${requesterId}`)
      .flush(new Blob(['{}'], { type: 'application/json' }), {
        status: 404,
        statusText: 'Not Found',
      });
    expect(result).toHaveBeenCalledWith(
      err(expect.objectContaining({ reason: 'missing' }))
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('rejects unexpected private fields and a response for a different route', () => {
    const result = jest.fn();
    adapter.read(ownerId).subscribe(result);
    http.expectOne(`/api/profiles/${ownerId}`).flush({
      access: 'visible',
      isOwner: false,
      profile: { ...source, identityId: 'CredentialUid' },
      follow,
    });
    expect(result).toHaveBeenCalledWith(
      err(expect.objectContaining({ reason: 'unavailable' }))
    );
    adapter.read(ownerId).subscribe(result);
    http.expectOne(`/api/profiles/${ownerId}`).flush({
      access: 'visible',
      isOwner: false,
      profile: { ...source, id: requesterId },
      follow: null,
    });
    expect(result.mock.calls.every(([response]) => response.ok === false)).toBe(
      true
    );
  });
  it('sends revision and exact key and decodes historical follow receipts', () => {
    const input = {
      ownerId,
      requesterId,
      expectedRevision: 0,
      action: 'request' as const,
    };
    const result = jest.fn();
    adapter.change(input, 'exact-key').subscribe(result);
    const request = http.expectOne('/api/me/profile-follows');
    expect(request.request.body).toEqual(input);
    expect(request.request.headers.get('Idempotency-Key')).toBe('exact-key');
    request.flush({ ...follow, revision: 1, status: 'pending' });
    expect(result).toHaveBeenCalledWith(
      ok({ ...follow, revision: 1, status: 'pending' })
    );
  });
  it('requests only the public route and visible cursor and validates shared favorite metadata', () => {
    const result = jest.fn();
    const cursor = `applications:${ownerId}`;
    adapter.favorites(ownerId, cursor).subscribe(result);
    const request = http.expectOne(
      (req) => req.url === `/api/profiles/${ownerId}/favorites`
    );
    expect(request.request.params.keys()).toEqual(['after']);
    expect(request.request.params.get('after')).toBe(cursor);
    request.flush(favoritesPage);
    expect(result).toHaveBeenCalledWith(ok(favoritesPage));
  });
  it('accepts an empty filtered page with a continuation without exposing metadata', () => {
    const result = jest.fn();
    const page = {
      sharing: 'visible',
      items: [],
      after: `applications:${requesterId}`,
    };
    adapter.favorites(ownerId, null).subscribe(result);
    http.expectOne(`/api/profiles/${ownerId}/favorites`).flush(page);
    expect(result).toHaveBeenCalledWith(ok(page));
  });
  it.each([
    { ...favoritesPage, identityId: 'CredentialUid' },
    { ...favoritesPage, sharing: 'hidden' },
    { ...favoritesPage, items: [{ ...favorite, slug: '../private' }] },
    { ...favoritesPage, items: [{ ...favorite, savedAt: 100 }] },
    { ...favoritesPage, after: `applications:${ownerId}` },
  ])('fails closed on malformed public favorite payloads: %j', (value) => {
    const result = jest.fn();
    adapter.favorites(ownerId, null).subscribe(result);
    http.expectOne(`/api/profiles/${ownerId}/favorites`).flush(value);
    expect(result).toHaveBeenCalledWith(
      err(expect.objectContaining({ reason: 'unavailable' }))
    );
  });
});
