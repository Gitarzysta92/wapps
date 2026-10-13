import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  PublishedRelease,
  ReleaseFields,
  ReleasePage,
} from '@domains/catalog/versioning';
import { ReleaseApiService } from './infrastructure/release-api.service';
import { LazyReleaseApiService } from './infrastructure/lazy-release-api.service';
import { ReleaseCatalogService } from './application/release-catalog.service';
import {
  APPLICATION_WORKSPACE_SESSION,
  APPLICATION_WORKSPACE_ORIGIN,
} from './application/application-drafts.port';
import {
  RELEASE_CATALOG,
  ReleaseRequestError,
  type ReleaseCatalogPort,
  type ReleaseChange,
} from './application/release-workspace.port';

const id = '019a0010-0000-7000-8000-000000000001';
const applicationId = '019a0010-0000-7000-8000-000000000002';
const fields: ReleaseFields = {
  version: '1.0+next',
  title: 'First release',
  description: 'Available now.',
  channel: 'stable',
  type: 'major',
  releasedOn: '2026-01-01',
  changes: [{ type: 'feature', description: 'Create a workspace.' }],
};
const published: PublishedRelease = {
  ...fields,
  id,
  applicationId,
  applicationName: 'Example',
  applicationSlug: 'example',
  revision: 1,
  publishedAt: Date.UTC(2026, 0, 1),
};
const command: ReleaseChange = {
  kind: 'draft',
  type: 'update',
  id,
  input: { expectedRevision: 1, fields },
};

describe('release HTTP boundary', () => {
  let api: ReleaseApiService;
  let http: HttpTestingController;
  let session: BehaviorSubject<string | null>;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReleaseApiService,
        LazyReleaseApiService,
        { provide: APPLICATION_WORKSPACE_ORIGIN, useValue: '' },
        {
          provide: APPLICATION_WORKSPACE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    api = TestBed.inject(ReleaseApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses the exact revision-bound command and idempotency key', async () => {
    const response = firstValueFrom(api.change(command, 'same-key'));
    const request = http.expectOne('/api/me/releases/' + id);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(command.input);
    expect(request.request.headers.get('Idempotency-Key')).toBe('same-key');
    request.flush({ id, revision: 2, deleted: false });
    expect((await response).ok).toBe(true);
  });
  it.each([
    {},
    { id, revision: 3, deleted: false },
    { id: applicationId, revision: 2, deleted: false },
    { id, revision: 2, deleted: true },
  ])(
    'retains uncertain writes for malformed or mismatched receipts: %j',
    async (receipt) => {
      const response = firstValueFrom(api.change(command, 'key'));
      http.expectOne('/api/me/releases/' + id).flush(receipt);
      const result = await response;
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatchObject({ uncertain: true });
    }
  );
  it.each([400, 401, 403, 404, 409, 429, 500, 503])(
    'classifies HTTP %i without retrying a different intent',
    async (status) => {
      const response = firstValueFrom(api.change(command, 'key'));
      http
        .expectOne('/api/me/releases/' + id)
        .flush({}, { status, statusText: 'Failure' });
      const result = await response;
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error).toMatchObject({
          status,
          uncertain: ![400, 401, 403, 404, 409].includes(status),
        });
    }
  );
  it('never starts a prepared write under a different account', async () => {
    const response = api.change(command, 'key');
    session.next('bob');
    const result = await firstValueFrom(response);
    expect(result.ok).toBe(false);
    http.expectNone('/api/me/releases/' + id);
  });
  it('fences writes before the lazy adapter has loaded', async () => {
    const api = TestBed.inject(LazyReleaseApiService);
    const response = api.change(command, 'key');
    session.next('bob');
    const result = await firstValueFrom(response);
    expect(result.ok).toBe(false);
    http.expectNone('/api/me/releases/' + id);
  });
  it('sends only review fields to the independent review endpoint', async () => {
    const input = {
      expectedRevision: 2,
      expectedPublicationRevision: null,
      submittedRevision: 1,
      reason: 'Checked.',
    };
    const response = firstValueFrom(
      api.change(
        { kind: 'publication', id, action: 'approve', input },
        'review-key'
      )
    );
    const request = http.expectOne(
      '/api/editorial/release-reviews/' + id + '/decision'
    );
    expect(request.request.body).toEqual({ decision: 'approve', ...input });
    request.flush({
      id,
      releaseId: applicationId,
      revision: 3,
      action: 'approve',
      submittedRevision: 1,
      publicationRevision: 1,
    });
    expect((await response).ok).toBe(true);
  });
  it('rejects a source for another application', async () => {
    const response = firstValueFrom(api.source(applicationId, null));
    http.expectOne('/api/me/releases/source/' + applicationId).flush({
      applicationId: id,
      applicationName: 'Other app',
      claimId: id,
      release: null,
    });
    expect((await response).ok).toBe(false);
  });
  it('encodes public version URLs and checks the returned version', async () => {
    const response = firstValueFrom(api.find('example', '1.0+next'));
    http.expectOne('/api/catalog/releases/example/1.0%2Bnext').flush(published);
    expect((await response).ok).toBe(true);
    const other = firstValueFrom(api.find('example', '2.0'));
    http.expectOne('/api/catalog/releases/example/2.0').flush(published);
    expect((await other).ok).toBe(false);
  });
  it('rejects wrong pages and cross-application public results', async () => {
    const response = firstValueFrom(api.browse('example', 1));
    http
      .expectOne('/api/catalog/releases/example?page=1')
      .flush({ items: [published], page: 2, total: 21 });
    expect((await response).ok).toBe(false);
    const other = firstValueFrom(api.browse('different-app', 1));
    http
      .expectOne('/api/catalog/releases/different-app?page=1')
      .flush({ items: [published], page: 1, total: 1 });
    expect((await other).ok).toBe(false);
  });
  it('sends channel and date filters and rejects nonmatching projected notes', async () => {
    const response = firstValueFrom(
      api.browse('example', 1, { channel: 'prerelease', before: '2026-02-01' })
    );
    http
      .expectOne(
        '/api/catalog/releases/example?page=1&channel=prerelease&before=2026-02-01'
      )
      .flush({ items: [published], page: 1, total: 1 });
    expect((await response).ok).toBe(false);
    const earlier = firstValueFrom(
      api.browse('example', 1, { before: '2026-01-01' })
    );
    http
      .expectOne('/api/catalog/releases/example?page=1&before=2026-01-01')
      .flush({ items: [published], page: 1, total: 1 });
    expect((await earlier).ok).toBe(false);
  });
});

describe('public release page state', () => {
  let service: ReleaseCatalogService;
  let port: jest.Mocked<ReleaseCatalogPort>;
  beforeEach(() => {
    port = {
      browse: jest
        .fn<ReturnType<ReleaseCatalogPort['browse']>, [string, number]>()
        .mockReturnValue(of(ok({ items: [], total: 0, page: 1 }))),
      find: jest
        .fn<ReturnType<ReleaseCatalogPort['find']>, [string, string]>()
        .mockReturnValue(of(ok(published))),
    };
    TestBed.configureTestingModule({
      providers: [
        ReleaseCatalogService,
        { provide: RELEASE_CATALOG, useValue: port },
      ],
    });
    service = TestBed.inject(ReleaseCatalogService);
  });
  it('distinguishes empty history, hidden notes and an unavailable projection', () => {
    service.open('example', null, 1);
    expect(service.error()).toBe('');
    expect(service.items()).toEqual([]);
    port.browse.mockReturnValue(
      of(err(new ReleaseRequestError('Not found', false, 404)))
    );
    service.open('example', null, 1);
    expect(service.missing()).toBe(true);
    port.browse.mockReturnValue(
      of(err(new ReleaseRequestError('Updating', false, 503)))
    );
    service.open('example', null, 1);
    expect(service.missing()).toBe(false);
    expect(service.error()).toBe('Updating');
  });
  it('cancels stale page reads and clears visible notes during navigation', () => {
    const first = new Subject<Result<ReleasePage, Error>>();
    port.browse.mockReturnValue(first);
    service.open('example', null, 1);
    service.open('example', '1.0+next', 1);
    first.next(ok({ items: [], page: 1, total: 0 }));
    first.complete();
    expect(service.items()).toEqual([published]);
    service.open('example', null, 2);
    expect(service.items()).toEqual([]);
    expect(port.browse).toHaveBeenLastCalledWith('example', 2, {});
  });
  it('refuses invalid pagination', () => {
    service.open('example', null, -1);
    expect(port.browse).not.toHaveBeenCalled();
  });
  it('paginates the selected channel on the server and rejects an unknown channel', () => {
    service.open('example', null, 2, 'prerelease');
    expect(port.browse).toHaveBeenLastCalledWith('example', 2, {
      channel: 'prerelease',
    });
    port.browse.mockClear();
    service.open('example', null, 1, 'private');
    expect(port.browse).not.toHaveBeenCalled();
    expect(service.error()).toContain('channel');
  });
  it('loads previous releases by earlier date without misreporting failed history as empty', () => {
    port.browse.mockReturnValue(
      of(err(new ReleaseRequestError('History updating', false, 503)))
    );
    service.open('example', published.version, 2);
    expect(port.browse).toHaveBeenLastCalledWith('example', 2, {
      before: published.releasedOn,
    });
    expect(service.items()).toEqual([published]);
    expect(service.previousError()).toBe('History updating');
  });
});
