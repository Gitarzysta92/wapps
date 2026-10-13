import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  ApplicationPublicationStatus,
  ApplicationPublicationReceipt,
} from '@domains/catalog/record';
import { ApplicationPublicationService } from './application/application-publication.service';
import {
  APPLICATION_PUBLICATION,
  type ApplicationPublicationPort,
} from './application/application-publication.port';
import {
  APPLICATION_DRAFTS,
  APPLICATION_WORKSPACE_ORIGIN,
  APPLICATION_WORKSPACE_SESSION,
  ApplicationDraftRequestError,
} from './application/application-drafts.port';
import { ApplicationPublicationApiService } from './infrastructure/application-publication-api.service';

const id = '019a0010-0000-7000-8000-000000000001';
const fields = {
  name: 'Example',
  slug: 'example',
  website: 'https://example.test',
  description: 'An application with enough detail.',
};
const status: ApplicationPublicationStatus = {
  id,
  revision: 2,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  publicSlug: null,
  latestSubmission: {
    ...fields,
    submittedRevision: 1,
    basePublicationRevision: null,
    status: 'submitted',
    submittedAt: 10,
    reviewedAt: null,
    reason: '',
    images: { logo: null, banner: null },
  },
};
const receipt: ApplicationPublicationReceipt = {
  id,
  revision: 3,
  action: 'approve',
  submittedRevision: 1,
  publicationRevision: 1,
};
describe('application publication state', () => {
  let session: BehaviorSubject<string | null>;
  let port: jest.Mocked<ApplicationPublicationPort>;
  let service: ApplicationPublicationService;
  const draft = { ...fields, id, revision: 2, createdAt: 10, updatedAt: 10 };
  const drafts = { read: jest.fn(() => of(ok(draft))) };
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    port = {
      status: jest
        .fn<
          ReturnType<ApplicationPublicationPort['status']>,
          Parameters<ApplicationPublicationPort['status']>
        >()
        .mockReturnValue(of(ok(status))),
      reviews: jest
        .fn<ReturnType<ApplicationPublicationPort['reviews']>, [number]>()
        .mockReturnValue(of(ok({ items: [status], page: 1, total: 1 }))),
      change: jest
        .fn<
          ReturnType<ApplicationPublicationPort['change']>,
          Parameters<ApplicationPublicationPort['change']>
        >()
        .mockReturnValue(of(ok(receipt))),
    };
    drafts.read.mockReturnValue(of(ok(draft)));
    TestBed.configureTestingModule({
      providers: [
        ApplicationPublicationService,
        { provide: APPLICATION_PUBLICATION, useValue: port },
        { provide: APPLICATION_DRAFTS, useValue: drafts },
        {
          provide: APPLICATION_WORKSPACE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ApplicationPublicationService);
  });
  it('refuses approval of legacy unknown image content while still allowing rejection', () => {
    port.status.mockReturnValue(
      of(
        ok({
          ...status,
          latestSubmission: status.latestSubmission
            ? { ...status.latestSubmission, images: null }
            : null,
        })
      )
    );
    service.open('review', id);
    service.change('approve');
    expect(port.change).not.toHaveBeenCalled();
    expect(service.error()).toContain('resubmit');
    service.change('reject', 'Please resubmit with current images.');
    expect(port.change.mock.calls[0][0].action).toBe('reject');
  });
  it('requires a consistent draft and publication revision before owner commands', () => {
    drafts.read.mockReturnValue(of(ok({ ...draft, revision: 3 })));
    service.open('owner', id);
    service.change('submit');
    expect(service.status()).toBeNull();
    expect(service.error()).toContain('changed while loading');
    expect(port.change).not.toHaveBeenCalled();
  });
  it('binds review to the immutable submitted revision and current aggregate revision', () => {
    service.open('review', id);
    service.change('approve');
    expect(port.change.mock.calls[0][0]).toEqual({
      id,
      action: 'approve',
      input: { expectedRevision: 2, submittedRevision: 1, reason: '' },
    });
  });
  it('keeps exact uncertain intent, refusing a different reviewer decision', () => {
    port.change.mockReturnValueOnce(
      of(err(new ApplicationDraftRequestError(true, 'unknown')))
    );
    service.open('review', id);
    service.change('approve');
    const original = port.change.mock.calls[0];
    service.change('reject', 'Different decision');
    expect(port.change).toHaveBeenCalledTimes(1);
    service.retry();
    expect(port.change.mock.calls[1]).toEqual(original);
    expect(service.feedback()).toContain('Approved');
    expect(service.uncertain()).toBe(false);
  });
  it('clears private state and ignores an old account response', () => {
    const response = new Subject<Result<ApplicationPublicationStatus, Error>>();
    port.status.mockReturnValue(response);
    service.open('review', id);
    session.next('bob');
    response.next(ok(status));
    expect(service.status()).toBeNull();
    expect(service.queue()).toEqual([]);
    expect(service.loading()).toBe(false);
  });
  it('cancels in-flight writes on account change without leaking feedback or retry intent', () => {
    const write = new Subject<Result<ApplicationPublicationReceipt, Error>>();
    port.change.mockReturnValue(write);
    service.open('review', id);
    service.change('approve');
    session.next('bob');
    write.next(ok(receipt));
    expect(service.feedback()).toBe('');
    expect(service.uncertain()).toBe(false);
    service.retry();
    expect(port.change).toHaveBeenCalledTimes(1);
  });
  it('rejects empty rejection reasons without making a request', () => {
    service.open('review', id);
    service.change('reject', ' ');
    expect(service.error()).toContain('reason');
    expect(port.change).not.toHaveBeenCalled();
  });
});

describe('application publication HTTP', () => {
  let api: ApplicationPublicationApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApplicationPublicationApiService,
        { provide: APPLICATION_WORKSPACE_ORIGIN, useValue: '' },
      ],
    });
    api = TestBed.inject(ApplicationPublicationApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses the explicit review endpoint and sends the submitted revision', () => {
    api
      .change(
        {
          id,
          action: 'approve',
          input: {
            expectedRevision: 2,
            submittedRevision: 1,
            reason: 'Reviewed',
          },
        },
        'key'
      )
      .subscribe((result) => expect(result).toEqual(ok(receipt)));
    const request = http.expectOne(
      `/api/editorial/application-reviews/${id}/decision`
    );
    expect(request.request.headers.get('Idempotency-Key')).toBe('key');
    expect(request.request.body).toEqual({
      decision: 'approve',
      expectedRevision: 2,
      submittedRevision: 1,
      reason: 'Reviewed',
    });
    request.flush(receipt);
  });
  it('treats an invalid committed receipt as uncertain', () => {
    api
      .change(
        {
          id,
          action: 'approve',
          input: { expectedRevision: 2, submittedRevision: 1, reason: '' },
        },
        'key'
      )
      .subscribe((result) => {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatchObject({ uncertain: true });
      });
    http
      .expectOne(`/api/editorial/application-reviews/${id}/decision`)
      .flush({ ...receipt, submittedRevision: 2 });
  });
  it('rejects unexpected detail identity and malformed review queues', () => {
    api.status(id, false).subscribe((result) => expect(result.ok).toBe(false));
    http
      .expectOne(`/api/me/application-drafts/${id}/publication`)
      .flush({ ...status, id: '019a0010-0000-7000-8000-000000000002' });
    api.reviews(1).subscribe((result) => expect(result.ok).toBe(false));
    http
      .expectOne('/api/editorial/application-reviews?page=1')
      .flush({ items: [status, status], page: 1, total: 2 });
  });
});
