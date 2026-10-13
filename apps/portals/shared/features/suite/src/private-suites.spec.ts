import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { PrivateSuite, SuiteReceipt } from '@domains/publication/suite';
import { PrivateSuitesService } from './application/private-suites.service';
import {
  PRIVATE_SUITES,
  SUITE_API_ORIGIN,
  SUITE_SESSION,
  SuiteRequestError,
  type PrivateSuitesPort,
} from './application/private-suites.port';
import { PrivateSuitesApiService } from './infrastructure/private-suites-api.service';

const id = '019a0010-0000-7000-8000-000000000001';
const suite: PrivateSuite = {
  id,
  title: 'Tools',
  description: '',
  applicationIds: [id],
  revision: 1,
  visibility: 'private',
  createdAt: 1,
  updatedAt: 1,
};
describe('private suite client state', () => {
  let session: BehaviorSubject<string | null>;
  let port: jest.Mocked<PrivateSuitesPort>;
  let service: PrivateSuitesService;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    port = {
      list: jest.fn(() => of(ok([suite]))),
      read: jest
        .fn<
          ReturnType<PrivateSuitesPort['read']>,
          Parameters<PrivateSuitesPort['read']>
        >()
        .mockReturnValue(of(ok(suite))),
      change: jest
        .fn<
          ReturnType<PrivateSuitesPort['change']>,
          Parameters<PrivateSuitesPort['change']>
        >()
        .mockReturnValue(of(ok({ id, revision: 1, deleted: false }))),
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
        PrivateSuitesService,
        { provide: PRIVATE_SUITES, useValue: port },
        {
          provide: SUITE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(PrivateSuitesService);
  });
  const fields = (service: PrivateSuitesService) => {
    service.title.set('Tools');
    service.selected.set([id]);
  };
  it('clears private forms and ignores obsolete reads on account change', () => {
    const read = new Subject<Result<PrivateSuite, Error>>();
    port.read.mockReturnValue(read);
    service.open(id);
    session.next('bob');
    read.next(ok(suite));
    expect(service.detail()).toBeNull();
    expect(service.selected()).toEqual([]);
    expect(service.title()).toBe('');
  });
  it('keeps exactly the same key for uncertain intent and refuses a new create', () => {
    port.change.mockReturnValueOnce(
      of(err(new SuiteRequestError(true, 'uncertain')))
    );
    fields(service);
    service.save().subscribe();
    const key = port.change.mock.calls[0][1];
    service.title.set('Different');
    service.save().subscribe();
    expect(port.change).toHaveBeenCalledTimes(1);
    service.retry().subscribe();
    expect(port.change.mock.calls[1][1]).toBe(key);
    expect(service.uncertain()).toBe(false);
  });
  it('blocks competing saves even during a list reload', () => {
    const write = new Subject<Result<SuiteReceipt, Error>>();
    port.change.mockReturnValue(write);
    fields(service);
    service.save().subscribe();
    service.list();
    service.save().subscribe();
    expect(port.change).toHaveBeenCalledTimes(1);
    expect(service.saving()).toBe(true);
    write.next(ok({ id, revision: 1, deleted: false }));
    write.complete();
    expect(service.saving()).toBe(false);
  });
  it('keeps removable membership when metadata fails', () => {
    port.resolve.mockReturnValue(of(err(new Error('offline'))));
    service.open(id);
    expect(service.selected()).toEqual([id]);
    expect(service.metadataError()).toContain('unchanged');
    service.remove(id);
    expect(service.selected()).toEqual([]);
  });
  it('retains retry intent after navigation cancels an unconfirmed save', () => {
    const write = new Subject<Result<SuiteReceipt, Error>>();
    port.change.mockReturnValue(write);
    fields(service);
    const subscription = service.save().subscribe();
    const key = port.change.mock.calls[0][1];
    subscription.unsubscribe();
    expect(service.uncertain()).toBe(true);
    expect(service.saving()).toBe(false);
    service.retry().subscribe();
    expect(port.change.mock.calls[1][1]).toBe(key);
  });
  it('binds edits and deletion to the loaded suite revision', () => {
    service.open(id);
    service.title.set('Renamed');
    service.save().subscribe();
    expect(port.change.mock.calls[0][0]).toMatchObject({
      type: 'update',
      id,
      expectedRevision: 1,
    });
    service.delete().subscribe();
    expect(port.change.mock.calls[1][0]).toMatchObject({
      type: 'delete',
      id,
      expectedRevision: 1,
    });
  });
  it('cancels old commands and clears retry intent when the session changes', () => {
    const write = new Subject<Result<SuiteReceipt, Error>>();
    port.change.mockReturnValue(write);
    const returned = jest.fn();
    fields(service);
    service.save().subscribe(returned);
    session.next(null);
    write.next(ok({ id, revision: 1, deleted: false }));
    expect(returned).not.toHaveBeenCalled();
    expect(service.uncertain()).toBe(false);
    expect(service.saving()).toBe(false);
  });
});

describe('suite HTTP contract', () => {
  let api: PrivateSuitesApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PrivateSuitesApiService,
        { provide: SUITE_API_ORIGIN, useValue: '' },
      ],
    });
    api = TestBed.inject(PrivateSuitesApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('rejects a success-shaped receipt for a different revision as uncertain', () => {
    const receive = jest.fn();
    api
      .change(
        { type: 'update', id, expectedRevision: 1, fields: suite },
        'retry-key'
      )
      .subscribe(receive);
    const request = http.expectOne('/api/me/suites/' + id);
    expect(request.request.headers.get('Idempotency-Key')).toBe('retry-key');
    request.flush({ id, revision: 8, deleted: false });
    expect(receive.mock.calls[0][0]).toMatchObject({
      ok: false,
      error: { uncertain: true },
    });
  });
  it('rejects malformed lists without replacing them with an empty successful result', () => {
    const receive = jest.fn();
    api.list().subscribe(receive);
    http.expectOne('/api/me/suites').flush({ items: [] });
    expect(receive.mock.calls[0][0].ok).toBe(false);
  });
});
