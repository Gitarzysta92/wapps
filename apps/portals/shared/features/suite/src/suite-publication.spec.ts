import {
  PublicContentPreferencesService,
  type PublicContentChoice,
} from '@portals/shared/features/preferences';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  PrivateSuite,
  SuitePublicationReceipt,
  SuitePublicationStatus,
} from '@domains/publication/suite';
import {
  PRIVATE_SUITES,
  SUITE_API_ORIGIN,
  SUITE_SESSION,
  SuiteRequestError,
  type PrivateSuitesPort,
} from './application/private-suites.port';
import {
  SUITE_PUBLICATION,
  type SuitePublicationPort,
} from './application/suite-publication.port';
import { SuitePublicationService } from './application/suite-publication.service';
import { SuitePublicationApiService } from './infrastructure/suite-publication-api.service';

const id = '019a0010-0000-7000-8000-000000000001';
const draft: PrivateSuite = {
  id,
  title: 'Tools',
  description: '',
  applicationIds: [id],
  revision: 1,
  visibility: 'private',
  createdAt: 1,
  updatedAt: 1,
};
const status: SuitePublicationStatus = {
  id,
  revision: 1,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  latestSubmission: null,
};
const receipt: SuitePublicationReceipt = {
  id,
  revision: 2,
  action: 'submit',
  submittedRevision: 1,
  publicationRevision: null,
};

describe('suite publication client state', () => {
  let session: BehaviorSubject<string | null>;
  let port: jest.Mocked<SuitePublicationPort>;
  let drafts: jest.Mocked<PrivateSuitesPort>;
  let service: SuitePublicationService;
  const choice = signal<PublicContentChoice>({
    status: 'ready',
    sessionKey: 'Alice',
    sessionVersion: 0,
    showMatureContent: true,
  });
  let choices: BehaviorSubject<PublicContentChoice>;
  const choose = (patch: Partial<PublicContentChoice>) => {
    choice.set({ ...choice(), ...patch });
    choices.next(choice());
  };
  beforeEach(() => {
    choice.set({
      status: 'ready',
      sessionKey: 'Alice',
      sessionVersion: 0,
      showMatureContent: true,
    });
    choices = new BehaviorSubject(choice());
    session = new BehaviorSubject<string | null>('Alice');
    port = {
      status: jest
        .fn<
          ReturnType<SuitePublicationPort['status']>,
          Parameters<SuitePublicationPort['status']>
        >()
        .mockReturnValue(of(ok(status))),
      change: jest
        .fn<
          ReturnType<SuitePublicationPort['change']>,
          Parameters<SuitePublicationPort['change']>
        >()
        .mockReturnValue(of(ok(receipt))),
      reviews: jest.fn(),
      browse: jest.fn(),
      find: jest.fn(),
    };
    drafts = {
      list: jest.fn(),
      read: jest
        .fn<
          ReturnType<PrivateSuitesPort['read']>,
          Parameters<PrivateSuitesPort['read']>
        >()
        .mockReturnValue(of(ok(draft))),
      change: jest.fn(),
      search: jest.fn(),
      resolve: jest
        .fn<
          ReturnType<PrivateSuitesPort['resolve']>,
          Parameters<PrivateSuitesPort['resolve']>
        >()
        .mockReturnValue(of(ok([]))),
    };
    TestBed.configureTestingModule({
      providers: [
        SuitePublicationService,
        {
          provide: PublicContentPreferencesService,
          useValue: {
            state: choice,
            changes$: choices,
            reload: jest.fn(),
          },
        },
        { provide: SUITE_PUBLICATION, useValue: port },
        { provide: PRIVATE_SUITES, useValue: drafts },
        {
          provide: SUITE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(SuitePublicationService);
  });
  it('preserves uncertain intent and blocks another action until the same key is retried', () => {
    service.open('owner', id);
    port.change.mockReturnValueOnce(
      of(err(new SuiteRequestError(true, 'uncertain')))
    );
    service.change('submit');
    const key = port.change.mock.calls[0][1];
    service.change('withdraw');
    expect(port.change).toHaveBeenCalledTimes(1);
    service.retry();
    expect(port.change.mock.calls[1][1]).toBe(key);
    expect(port.change.mock.calls[1][0]).toEqual(port.change.mock.calls[0][0]);
    expect(service.uncertain()).toBe(false);
  });
  it('clears review feedback, private snapshots and pending commands when the account changes', () => {
    service.open('owner', id);
    const write = new Subject<Result<SuitePublicationReceipt, Error>>();
    port.change.mockReturnValue(write);
    service.change('submit');
    session.next('Bob');
    write.next(ok(receipt));
    expect(service.draft()).toBeNull();
    expect(service.status()).toBeNull();
    expect(service.feedback()).toBe('');
    expect(service.uncertain()).toBe(false);
    expect(service.saving()).toBe(false);
    service.retry();
    expect(port.change).toHaveBeenCalledTimes(1);
  });
  it('rejects an incoherent owner read instead of submitting a different revision', () => {
    drafts.read.mockReturnValue(of(ok({ ...draft, revision: 2 })));
    service.open('owner', id);
    service.change('submit');
    expect(service.error()).toContain('changed while loading');
    expect(service.status()).toBeNull();
    expect(port.change).not.toHaveBeenCalled();
  });
  it('ignores obsolete review reads after a route change', () => {
    const delayed = new Subject<Result<SuitePublicationStatus, Error>>();
    port.status.mockReturnValueOnce(delayed);
    service.open('review', id);
    port.reviews.mockReturnValue(of(ok({ items: [], total: 0, page: 1 })));
    service.open('queue');
    delayed.next(ok(status));
    expect(service.status()).toBeNull();
    expect(service.queue()).toEqual([]);
  });
  it('binds approval to the frozen submission instead of the newer draft revision', () => {
    port.status.mockReturnValue(
      of(
        ok({
          ...status,
          revision: 8,
          latestSubmission: {
            title: 'Frozen tools',
            description: '',
            applicationIds: [id],
            submittedRevision: 2,
            status: 'submitted' as const,
            submittedAt: 10,
            reviewedAt: null,
            reason: '',
          },
        })
      )
    );
    service.open('review', id);
    service.change('approve');
    expect(port.change.mock.calls[0][0]).toEqual({
      id,
      action: 'approve',
      input: { expectedRevision: 8, submittedRevision: 2, reason: '' },
    });
  });
  it('allows anonymous public reads and clears stale content after failure', () => {
    session.next(null);
    port.find.mockReturnValueOnce(
      of(
        ok({
          id,
          revision: 1,
          submittedRevision: 1,
          publishedAt: 10,
          title: 'Public',
          description: '',
          applicationIds: [id],
        })
      )
    );
    service.open('public', id);
    expect(service.detail()?.title).toBe('Public');
    port.find.mockReturnValue(of(err(new Error('Unavailable'))));
    service.reload();
    expect(service.detail()).toBeNull();
    expect(service.error()).toBe('Unavailable');
  });
  it('filters public suites without changing totals and keeps private author/review reads available', () => {
    const suite = {
      id,
      revision: 1,
      submittedRevision: 1,
      publishedAt: 10,
      title: 'Suite',
      description: '',
      applicationIds: [id],
    };
    choose({ showMatureContent: false });
    port.browse.mockReturnValue(
      of(
        ok({
          items: [
            suite,
            { ...suite, classification: 'mature' as const },
            { ...suite, classification: 'general' as const },
          ],
          total: 24,
          page: 1,
        })
      )
    );
    service.open('catalog');
    expect(service.items()).toEqual([{ ...suite, classification: 'general' }]);
    expect(service.total()).toBe(24);
    expect(service.hiddenCount()).toBe(2);
    port.find.mockReturnValue(of(ok(suite)));
    service.open('public', id);
    expect(service.hidden()).toBe(true);
    expect(service.detail()).toBeNull();
    expect(drafts.resolve).not.toHaveBeenCalled();
    choose({ status: 'unavailable' });
    service.open('owner', id);
    expect(service.draft()).toEqual(draft);
    expect(service.preferencesError()).toBe(false);
    choose({ status: 'loading' });
    expect(service.draft()).toEqual(draft);
    service.open('review', id);
    expect(service.status()).toEqual(status);
  });
  it('distinguishes hidden members from unavailable members and cancels late metadata', () => {
    const suite = {
      id,
      revision: 1,
      submittedRevision: 1,
      publishedAt: 10,
      title: 'Suite',
      description: '',
      applicationIds: [id],
      classification: 'general' as const,
    };
    const app = {
      id,
      revision: 1,
      slug: 'member',
      name: 'Hidden member',
      description: '',
      website: null,
      logoUrl: null,
      bannerUrl: null,
      isPwa: false,
      estimatedNumberOfUsers: null,
      createdAt: '2026-10-13T00:00:00.000Z',
      updatedAt: '2026-10-13T00:00:00.000Z',
      categories: [],
      tags: [],
      platforms: [],
      devices: [],
      monetizations: [],
      reviews: null,
    };
    port.find.mockReturnValue(of(ok(suite)));
    drafts.resolve.mockReturnValue(of(ok([app])));
    choose({ showMatureContent: false });
    service.open('public', id);
    expect(service.detail()).toEqual(suite);
    expect(service.members()).toEqual([]);
    expect(service.hiddenMemberIds()).toEqual([id]);
    choose({ showMatureContent: true });
    expect(service.member(id)?.name).toBe('Hidden member');
    const late = new Subject<Result<(typeof app)[], Error>>();
    drafts.resolve.mockReturnValueOnce(late);
    service.retryMembers();
    choose({ status: 'loading', showMatureContent: false });
    late.next(ok([app]));
    expect(service.members()).toEqual([]);
    expect(service.detail()).toBeNull();
    expect(service.loading()).toBe(true);
    choose({ status: 'unavailable' });
    expect(service.preferencesError()).toBe(true);
    choose({ status: 'ready' });
    expect(service.detail()).toEqual(suite);
    expect(service.hiddenMemberIds()).toEqual([id]);
  });
});

describe('suite publication API receipts', () => {
  let api: SuitePublicationApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SuitePublicationApiService,
        { provide: SUITE_API_ORIGIN, useValue: '' },
      ],
    });
    api = TestBed.inject(SuitePublicationApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('treats a success response for the wrong submitted revision as unconfirmed', () => {
    const received = jest.fn();
    api
      .change(
        {
          id,
          action: 'approve',
          input: { expectedRevision: 4, submittedRevision: 2, reason: '' },
        },
        'approval-key'
      )
      .subscribe(received);
    const request = http.expectOne(
      `/api/editorial/suite-reviews/${id}/decision`
    );
    expect(request.request.headers.get('Idempotency-Key')).toBe('approval-key');
    request.flush({
      ...receipt,
      action: 'approve',
      revision: 5,
      submittedRevision: 3,
      publicationRevision: 1,
    });
    expect(received.mock.calls[0][0]).toMatchObject({
      ok: false,
      error: { uncertain: true },
    });
  });
  it('rejects a malformed public page without demo or empty-data fallback', () => {
    const received = jest.fn();
    api.browse({ q: '', page: 1 }).subscribe(received);
    http
      .expectOne('/api/catalog/suites?q=&page=1')
      .flush({ items: [], total: 0, page: 2 });
    expect(received.mock.calls[0][0].ok).toBe(false);
  });
});
