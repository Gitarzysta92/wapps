import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  ApplicationDraft,
  ApplicationDraftReceipt,
} from '@domains/catalog/record';
import { ApplicationDraftsService } from './application/application-drafts.service';
import {
  APPLICATION_DRAFTS,
  APPLICATION_WORKSPACE_ORIGIN,
  APPLICATION_WORKSPACE_SESSION,
  ApplicationDraftRequestError,
  type ApplicationDraftsPort,
} from './application/application-drafts.port';
import { ApplicationDraftsApiService } from './infrastructure/application-drafts-api.service';
import { provideApplicationWorkspace } from './application-workspace.providers';

const id = '019a0010-0000-7000-8000-000000000001';
const fields = {
  name: 'Example',
  slug: 'example',
  website: 'https://example.test',
  description: 'An application with enough detail.',
};
const draft: ApplicationDraft = {
  ...fields,
  id,
  revision: 1,
  createdAt: 10,
  updatedAt: 10,
};
const receipt = { id, revision: 1, deleted: false };
describe('application workspace state', () => {
  let session: BehaviorSubject<string | null>;
  let port: jest.Mocked<ApplicationDraftsPort>;
  let service: ApplicationDraftsService;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    port = {
      list: jest
        .fn<ReturnType<ApplicationDraftsPort['list']>, []>()
        .mockReturnValue(of(ok([draft]))),
      read: jest
        .fn<ReturnType<ApplicationDraftsPort['read']>, [string]>()
        .mockReturnValue(of(ok(draft))),
      change: jest
        .fn<
          ReturnType<ApplicationDraftsPort['change']>,
          Parameters<ApplicationDraftsPort['change']>
        >()
        .mockReturnValue(of(ok(receipt))),
    };
    TestBed.configureTestingModule({
      providers: [
        ApplicationDraftsService,
        { provide: APPLICATION_DRAFTS, useValue: port },
        {
          provide: APPLICATION_WORKSPACE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ApplicationDraftsService);
  });
  const prepare = (service: ApplicationDraftsService) => {
    service.open('edit');
    service.fields.set({ ...fields });
  };
  it('clears private state and ignores old reads after switching accounts', () => {
    const read = new Subject<Result<ApplicationDraft, Error>>();
    port.read.mockReturnValue(read);
    service.open('edit', id);
    session.next('bob');
    read.next(ok(draft));
    expect(service.detail()).toBeNull();
    expect(service.fields().name).toBe('');
    expect(service.items()).toEqual([]);
    expect(service.loading()).toBe(false);
  });
  it('rejects a prepared command subscribed after switching accounts', () => {
    prepare(service);
    const operation = service.save();
    session.next('bob');
    operation.subscribe((result) => expect(result.ok).toBe(false));
    expect(port.change).not.toHaveBeenCalled();
  });
  it('cancels obsolete route reads', () => {
    const read = new Subject<Result<ApplicationDraft, Error>>();
    port.read.mockReturnValue(read);
    service.open('edit', id);
    service.open('list');
    read.next(ok(draft));
    expect(service.detail()).toBeNull();
    expect(service.items()).toEqual([draft]);
  });
  it('binds save and delete to a loaded canonical revision', () => {
    service.open('edit', id);
    service.setField('name', 'Edited');
    service.save().subscribe();
    expect(port.change.mock.calls[0][0]).toMatchObject({
      type: 'update',
      id,
      expectedRevision: 1,
      fields: { name: 'Edited' },
    });
    service.remove(draft).subscribe();
    expect(port.change.mock.calls[1][0]).toEqual({
      type: 'delete',
      id,
      expectedRevision: 1,
      fields: null,
    });
  });
  it('advances an acknowledged image revision without erasing unsaved text', () => {
    service.open('edit', id);
    service.setField('name', 'Unsaved application title');
    const current = {
      ...draft,
      revision: 2,
      images: { logo: null, banner: null },
    };
    port.read.mockReturnValue(of(ok(current)));
    service.acceptImageChange({ id, revision: 2, deleted: false });
    expect(service.detail()).toEqual(current);
    expect(service.fields().name).toBe('Unsaved application title');
    service.acceptImageChange({ id, revision: 2, deleted: false });
    expect(service.error()).toBe('');
    expect(service.fields().name).toBe('Unsaved application title');
    service.save().subscribe();
    expect(port.change.mock.calls[0][0].expectedRevision).toBe(2);
  });
  it('does not silently adopt an intervening text edit after an old image receipt', () => {
    service.open('edit', id);
    service.setField('name', 'Unsaved application title');
    port.read.mockReturnValue(
      of(ok({ ...draft, revision: 3, name: 'Other session edit' }))
    );
    service.acceptImageChange({ id, revision: 2, deleted: false });
    expect(service.detail()?.revision).toBe(1);
    expect(service.fields().name).toBe('Unsaved application title');
    expect(service.error()).toContain('changed during the image request');
  });
  it('never creates a missing or failed-to-load existing draft', () => {
    port.read.mockReturnValue(of(err(new Error('not found'))));
    service.open('edit', id);
    service.fields.set(fields);
    service.save().subscribe();
    expect(port.change).not.toHaveBeenCalled();
    expect(service.error()).toContain('Load the draft');
  });
  it('retains exact uncertain intent and key across navigation, blocking different changes', () => {
    port.change.mockReturnValueOnce(
      of(err(new ApplicationDraftRequestError(true, 'unknown')))
    );
    prepare(service);
    service.save().subscribe();
    const [command, key] = port.change.mock.calls[0];
    service.setField('name', 'Ignored');
    expect(service.fields().name).toBe(fields.name);
    service.open('edit');
    service.fields.set({ ...fields, name: 'Different' });
    service.save().subscribe();
    expect(port.change).toHaveBeenCalledTimes(1);
    service.retry().subscribe();
    expect(port.change.mock.calls[1]).toEqual([command, key]);
    expect(service.uncertain()).toBe(false);
  });
  it('retains an unconfirmed request when navigation unsubscribes', () => {
    port.change.mockReturnValue(
      new Subject<Result<ApplicationDraftReceipt, Error>>()
    );
    prepare(service);
    const subscription = service.save().subscribe();
    const original = port.change.mock.calls[0];
    subscription.unsubscribe();
    expect(service.uncertain()).toBe(true);
    expect(service.saving()).toBe(false);
    port.change.mockReturnValue(of(ok(receipt)));
    service.retry().subscribe();
    expect(port.change.mock.calls[1]).toEqual(original);
  });
  it('clears pending writes on account changes without accepting old success', () => {
    const write = new Subject<Result<ApplicationDraftReceipt, Error>>();
    port.change.mockReturnValue(write);
    prepare(service);
    service.save().subscribe();
    session.next('bob');
    write.next(ok(receipt));
    expect(service.feedback()).toBe('');
    expect(service.uncertain()).toBe(false);
    service.retry().subscribe();
    expect(port.change).toHaveBeenCalledTimes(1);
  });
  it('blocks concurrent writes and writes during canonical reload', () => {
    const write = new Subject<Result<ApplicationDraftReceipt, Error>>();
    port.change.mockReturnValue(write);
    prepare(service);
    service.save().subscribe();
    service.save().subscribe();
    expect(port.change).toHaveBeenCalledTimes(1);
    port.list.mockReturnValue(new Subject<Result<ApplicationDraft[], Error>>());
    service.open('list');
    service.remove(draft).subscribe();
    expect(port.change).toHaveBeenCalledTimes(1);
  });
  it('rereads the canonical revision after success and retains save feedback', () => {
    service.open('edit', id);
    service.save().subscribe();
    port.read.mockReturnValue(of(ok({ ...draft, revision: 2 })));
    service.open('edit', id);
    expect(service.detail()?.revision).toBe(2);
    expect(service.feedback()).toContain('saved');
    service.setField('name', 'Another edit');
    expect(service.feedback()).toBe('');
  });
  it('clears definitive failures so a reloaded revision can be saved with a fresh key', () => {
    port.change.mockReturnValueOnce(
      of(err(new ApplicationDraftRequestError(false, 'conflict')))
    );
    service.open('edit', id);
    service.save().subscribe();
    expect(service.uncertain()).toBe(false);
    port.read.mockReturnValue(of(ok({ ...draft, revision: 2 })));
    service.reload();
    service.save().subscribe();
    expect(port.change.mock.calls[1][1]).not.toBe(port.change.mock.calls[0][1]);
    expect(port.change.mock.calls[1][0].expectedRevision).toBe(2);
  });
  it('reports invalid fields locally and makes no unsigned requests', () => {
    service.open('edit');
    service.save().subscribe();
    expect(service.error()).toContain('name');
    session.next(null);
    prepare(service);
    service.save().subscribe();
    service.open('list');
    expect(port.change).not.toHaveBeenCalled();
    expect(port.list).not.toHaveBeenCalled();
  });
});

describe('application draft HTTP contract', () => {
  let api: ApplicationDraftsApiService;
  let http: HttpTestingController;
  const url = '/api/me/application-drafts';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApplicationDraftsApiService,
        { provide: APPLICATION_WORKSPACE_ORIGIN, useValue: '' },
      ],
    });
    api = TestBed.inject(ApplicationDraftsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('requires explicit API/demo mode and a bare HTTP origin', () => {
    expect(
      provideApplicationWorkspace({ mode: 'demo', apiBaseUrl: '' }).providers
    ).toEqual([]);
    expect(() =>
      provideApplicationWorkspace({
        mode: 'api',
        apiBaseUrl: 'https://example.test/private',
      })
    ).toThrow();
    expect(() =>
      provideApplicationWorkspace({
        mode: 'api',
        apiBaseUrl: 'https://user:pass@example.test',
      })
    ).toThrow();
  });
  it('rejects duplicate or malformed list snapshots without demo fallback', () => {
    api.list().subscribe((result) => expect(result.ok).toBe(false));
    http.expectOne(url).flush([draft, draft]);
  });
  it('binds detail results to the requested canonical ID', () => {
    api.read(id).subscribe((result) => expect(result.ok).toBe(false));
    http
      .expectOne(`${url}/${id}`)
      .flush({ ...draft, id: '019a0010-0000-7000-8000-000000000002' });
  });
  it('rejects unsafe path IDs before issuing HTTP', () => {
    api.read('../escape').subscribe((result) => expect(result.ok).toBe(false));
    http.expectNone(() => true);
  });
  it('sends create fields without owner claims and validates the immutable receipt', () => {
    api
      .change(
        { type: 'create', id: null, expectedRevision: null, fields },
        'key'
      )
      .subscribe((result) => expect(result).toEqual(ok(receipt)));
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(fields);
    expect(request.request.headers.get('Idempotency-Key')).toBe('key');
    request.flush(receipt);
  });
  it('sends revision-bound deletes and treats a mismatched receipt as uncertain', () => {
    api
      .change({ type: 'delete', id, expectedRevision: 1, fields: null }, 'key')
      .subscribe((result) => {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatchObject({ uncertain: true });
      });
    const request = http.expectOne(`${url}/${id}`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ expectedRevision: 1 });
    request.flush({ id, revision: 2, deleted: false });
  });
  it.each([400, 401, 403, 404, 409, 500, 503])(
    'classifies HTTP %i without inventing a success',
    (status) => {
      api
        .change({ type: 'update', id, expectedRevision: 1, fields }, 'key')
        .subscribe((result) => {
          expect(result.ok).toBe(false);
          if (!result.ok)
            expect(result.error).toMatchObject({ uncertain: status >= 500 });
        });
      http
        .expectOne(`${url}/${id}`)
        .flush({}, { status, statusText: 'failure' });
    }
  );
});
