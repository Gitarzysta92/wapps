import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  OwnershipClaim,
  OwnershipReceipt,
} from '@domains/catalog/ownership';
import { ApplicationOwnershipService } from './application/application-ownership.service';
import {
  APPLICATION_OWNERSHIP,
  type ApplicationOwnershipPort,
} from './application/application-ownership.port';
import {
  APPLICATION_WORKSPACE_ORIGIN,
  APPLICATION_WORKSPACE_SESSION,
  ApplicationDraftRequestError,
} from './application/application-drafts.port';
import { ApplicationOwnershipApiService } from './infrastructure/application-ownership-api.service';

const appId = '019a0010-0000-7000-8000-000000000001';
const id = '019a0010-0000-7000-8000-000000000002';
const claim: OwnershipClaim = {
  id,
  applicationId: appId,
  claimantIdentityId: 'Alice',
  revision: 1,
  applicationRevision: 1,
  applicationName: 'Example',
  applicationSlug: 'example',
  website: 'https://example.test',
  hostname: 'example.test',
  evidenceUrl: 'https://example.test/team',
  notes: 'I maintain the official website and application.',
  challengeName: '_wapps-ownership.example.test',
  challengeValue: 'wapps-ownership=' + 'a'.repeat(64),
  status: 'awaiting-proof' as const,
  createdAt: 10,
  updatedAt: 10,
  expiresAt: 604800010,
  verifiedAt: null,
  reviewedAt: null,
  reason: '',
};
const created: OwnershipReceipt = {
  id,
  revision: 1,
  action: 'create',
  status: 'awaiting-proof',
  proofMatched: null,
  applicationRevision: null,
};
const verified: OwnershipReceipt = {
  id,
  revision: 2,
  action: 'verify',
  status: 'awaiting-review',
  proofMatched: true,
  applicationRevision: null,
};

describe('ownership portal state', () => {
  let session: BehaviorSubject<string | null>;
  let port: jest.Mocked<ApplicationOwnershipPort>;
  let service: ApplicationOwnershipService;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    port = {
      application: jest.fn().mockReturnValue(
        of(
          ok({
            id: appId,
            name: 'Example',
            slug: 'example',
            website: claim.website,
          })
        )
      ),
      list: jest
        .fn()
        .mockReturnValue(of(ok({ items: [claim], page: 1, total: 1 }))),
      read: jest.fn().mockReturnValue(of(ok(claim))),
      change: jest.fn().mockReturnValue(of(ok(verified))),
    };
    TestBed.configureTestingModule({
      providers: [
        ApplicationOwnershipService,
        { provide: APPLICATION_OWNERSHIP, useValue: port },
        {
          provide: APPLICATION_WORKSPACE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ApplicationOwnershipService);
  });
  it('binds claim creation to the loaded application without accepting caller ownership', () => {
    port.change.mockReturnValue(of(ok(created)));
    service.open('create', '', 'example');
    service.create(claim.evidenceUrl, claim.notes).subscribe();
    expect(port.change.mock.calls[0][0]).toEqual({
      action: 'create',
      input: {
        applicationId: appId,
        evidenceUrl: claim.evidenceUrl,
        notes: claim.notes,
      },
    });
  });
  it('binds verification to the current claim revision and distinguishes negative proof', () => {
    port.change.mockReturnValue(
      of(
        ok({
          ...verified,
          proofMatched: false,
          status: 'awaiting-proof' as const,
        })
      )
    );
    service.open('owner', id);
    service.change('verify').subscribe();
    expect(port.change.mock.calls[0][0]).toEqual({
      id,
      action: 'verify',
      input: { expectedRevision: 1, reason: '' },
    });
    expect(service.feedback()).toContain('not found');
  });
  it('retains exact uncertain intent across route changes and refuses a different command', () => {
    port.change.mockReturnValueOnce(
      of(err(new ApplicationDraftRequestError(true, 'unknown')))
    );
    service.open('owner', id);
    service.change('verify').subscribe();
    const attempt = port.change.mock.calls[0];
    service.change('cancel').subscribe();
    expect(port.change).toHaveBeenCalledTimes(1);
    service.open('list');
    service.retry().subscribe();
    expect(port.change.mock.calls[1]).toEqual(attempt);
    expect(service.uncertain()).toBe(false);
  });
  it('keeps an interrupted page request retryable with the original key', () => {
    const write = new Subject<Result<OwnershipReceipt, Error>>();
    port.change.mockReturnValue(write);
    service.open('owner', id);
    const subscription = service.change('verify').subscribe();
    subscription.unsubscribe();
    expect(service.uncertain()).toBe(true);
    port.change.mockReturnValue(of(ok(verified)));
    service.retry().subscribe();
    expect(port.change.mock.calls[1]).toEqual(port.change.mock.calls[0]);
  });
  it('clears private data and retry state on account change and ignores delayed writes', () => {
    const write = new Subject<Result<OwnershipReceipt, Error>>();
    port.change.mockReturnValue(write);
    service.open('owner', id);
    service.change('verify').subscribe();
    session.next('bob');
    write.next(ok(verified));
    service.retry().subscribe();
    expect(service.claim()).toBeNull();
    expect(service.items()).toEqual([]);
    expect(service.feedback()).toBe('');
    expect(service.uncertain()).toBe(false);
    expect(port.change).toHaveBeenCalledTimes(1);
  });
  it('refuses an operation constructed under the previous account', () => {
    service.open('owner', id);
    const operation = service.change('verify');
    session.next('bob');
    operation.subscribe();
    expect(port.change).not.toHaveBeenCalled();
  });
  it('ignores reads superseded by another route and loads staff grants explicitly', () => {
    const delayed = new Subject<Result<OwnershipClaim, Error>>();
    port.read.mockReturnValue(delayed);
    service.open('owner', id);
    service.open('grants', '', '', 2);
    delayed.next(ok(claim));
    expect(service.claim()).toBeNull();
    expect(port.list).toHaveBeenLastCalledWith(true, 2, true);
  });
  it('does not submit invalid evidence or empty rejection reasons', () => {
    service.open('create', '', 'example');
    service.create('javascript:bad', claim.notes).subscribe();
    service.open('review', id);
    service.change('reject', '').subscribe();
    expect(port.change).not.toHaveBeenCalled();
  });
});

describe('ownership and editing HTTP contracts', () => {
  let api: ApplicationOwnershipApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApplicationOwnershipApiService,
        { provide: APPLICATION_WORKSPACE_ORIGIN, useValue: '' },
      ],
    });
    api = TestBed.inject(ApplicationOwnershipApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses the owner verification endpoint with only the allowed fields', () => {
    api
      .change(
        { id, action: 'verify', input: { expectedRevision: 1, reason: '' } },
        'proof-key'
      )
      .subscribe((value) => expect(value).toEqual(ok(verified)));
    const request = http.expectOne(`/api/me/ownership-claims/${id}/verify`);
    expect(request.request.body).toEqual({ expectedRevision: 1 });
    expect(request.request.headers.get('Idempotency-Key')).toBe('proof-key');
    request.flush(verified);
  });
  it('uses the staff decision endpoint for revocation, retaining the explicit reason', () => {
    api
      .change(
        {
          id,
          action: 'revoke',
          input: { expectedRevision: 3, reason: 'Confirmed dispute.' },
        },
        'revoke-key'
      )
      .subscribe();
    const request = http.expectOne(
      `/api/editorial/ownership-reviews/${id}/decision`
    );
    expect(request.request.body).toEqual({
      decision: 'revoke',
      expectedRevision: 3,
      reason: 'Confirmed dispute.',
    });
    request.flush({
      id,
      revision: 4,
      action: 'revoke',
      status: 'revoked',
      applicationRevision: 3,
      proofMatched: null,
    });
  });
  it('rejects mismatched receipts as uncertain rather than claiming verification', () => {
    api
      .change(
        { id, action: 'verify', input: { expectedRevision: 1, reason: '' } },
        'key'
      )
      .subscribe((value) => {
        expect(value.ok).toBe(false);
        if (!value.ok) expect(value.error).toMatchObject({ uncertain: true });
      });
    http
      .expectOne(`/api/me/ownership-claims/${id}/verify`)
      .flush({ ...verified, id: appId });
  });
  it('binds claim and canonical source responses to the requested IDs', () => {
    api.read(id, false).subscribe((value) => expect(value.ok).toBe(false));
    http
      .expectOne(`/api/me/ownership-claims/${id}`)
      .flush({ ...claim, id: appId });
    api.source(appId).subscribe((value) => expect(value.ok).toBe(false));
    http.expectOne(`/api/me/application-drafts/canonical/${appId}`).flush({
      applicationId: id,
      claimId: id,
      sourcePublicationRevision: 2,
      fields: { name: '', slug: '', website: '', description: '' },
    });
  });
  it('requests active grants explicitly and validates the returned page', () => {
    api.list(true, 2, true).subscribe((value) => expect(value.ok).toBe(false));
    http
      .expectOne('/api/editorial/ownership-reviews?page=2&view=grants')
      .flush({ page: 1, total: 0, items: [] });
  });
  it('sends a merged payload with private and canonical revisions and rejects the wrong draft receipt', () => {
    const command = {
      type: 'rebase' as const,
      id,
      expectedRevision: 4,
      editing: {
        applicationId: appId,
        claimId: appId,
        sourcePublicationRevision: 9,
      },
      fields: {
        name: 'Example',
        slug: 'example',
        website: 'https://example.test',
        description: 'A sufficient application description.',
      },
    };
    api.edit(command, 'merge-key').subscribe((value) => {
      expect(value.ok).toBe(false);
      if (!value.ok) expect(value.error).toMatchObject({ uncertain: true });
    });
    const request = http.expectOne(`/api/me/application-drafts/${id}/rebase`);
    expect(request.request.body).toEqual({
      expectedRevision: 4,
      editing: command.editing,
      fields: command.fields,
    });
    expect(request.request.headers.get('Idempotency-Key')).toBe('merge-key');
    request.flush({ id: appId, revision: 5, deleted: false });
  });
  it.each([400, 401, 403, 404, 409, 429, 500, 503])(
    'classifies HTTP %i without local fallback',
    (status) => {
      api
        .change(
          { id, action: 'verify', input: { expectedRevision: 1, reason: '' } },
          'key'
        )
        .subscribe((value) => {
          expect(value.ok).toBe(false);
          if (!value.ok)
            expect(value.error).toMatchObject({ uncertain: status >= 500 });
        });
      http
        .expectOne(`/api/me/ownership-claims/${id}/verify`)
        .flush({}, { status, statusText: 'failure' });
    }
  );
  it('rejects invalid IDs before issuing requests', () => {
    api.source('../other').subscribe((value) => expect(value.ok).toBe(false));
    api
      .read('../other', true)
      .subscribe((value) => expect(value.ok).toBe(false));
    http.expectNone(() => true);
  });
});
