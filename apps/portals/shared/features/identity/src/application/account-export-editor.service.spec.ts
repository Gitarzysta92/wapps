import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { AccountExportJob } from '@sdk/features/identity/core';
import { AUTHENTICATION_SESSION } from './authentication-session.port';
import { ACCOUNT_EXPORT, AccountExportError } from './account-export.port';
import { AccountExportEditorService } from './account-export-editor.service';

describe('private account export workflow', () => {
  const token = new BehaviorSubject<string | null>('alice');
  const port = {
    latest: jest.fn(),
    request: jest.fn(),
    cancel: jest.fn(),
    download: jest.fn(),
    save: jest.fn(),
    newKey: jest.fn(),
  };
  const unavailable = new AccountExportError('unavailable', 'Unavailable');
  let queued: AccountExportJob, ready: AccountExportJob;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    token.next('alice');
    queued = {
      id: '00000000-0000-4000-8000-000000000042',
      status: 'queued',
      requestedAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
      readyAt: null,
      bytes: null,
      sha256: null,
      attempts: 0,
      failure: null,
    };
    ready = {
      ...queued,
      status: 'ready',
      readyAt: Date.now(),
      bytes: 100,
      sha256: 'a'.repeat(64),
      attempts: 1,
    };
    port.latest.mockReturnValue(of(ok(null)));
    port.request.mockReturnValue(of(ok(queued)));
    port.newKey.mockReturnValue('exact-intent');
    TestBed.configureTestingModule({
      providers: [
        AccountExportEditorService,
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
        { provide: ACCOUNT_EXPORT, useValue: port },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    jest.useRealTimers();
  });
  it('polls durable progress and recovers ready status without creating a second request', () => {
    const service = TestBed.inject(AccountExportEditorService);
    service.request();
    service.request();
    expect(port.request).toHaveBeenCalledTimes(1);
    port.latest.mockReturnValue(of(ok(ready)));
    jest.advanceTimersByTime(2000);
    expect(service.job()).toEqual(ready);
    expect(service.canRequest()).toBe(false);
  });
  it('retains the exact key after an uncertain request even across a status refresh', () => {
    const service = TestBed.inject(AccountExportEditorService);
    port.request.mockReturnValueOnce(of(err(unavailable)));
    service.request();
    expect(service.uncertain()).toBe(true);
    expect(port.request).toHaveBeenCalledTimes(1);
    service.refresh();
    service.request();
    expect(port.request.mock.calls.map((args) => args[0])).toEqual([
      'exact-intent',
      'exact-intent',
    ]);
    expect(port.newKey).toHaveBeenCalledTimes(1);
    expect(service.uncertain()).toBe(false);
  });
  it('requires a fresh canonical read after a conflict or status outage', () => {
    const service = TestBed.inject(AccountExportEditorService);
    port.request.mockReturnValue(
      of(err(new AccountExportError('conflict', 'Existing job')))
    );
    service.request();
    expect(service.canRequest()).toBe(false);
    expect(service.uncertain()).toBe(false);
    port.latest.mockReturnValue(of(ok(ready)));
    service.refresh();
    port.latest.mockReturnValue(of(err(unavailable)));
    service.refresh();
    expect(service.job()?.status).toBe('ready');
    expect(service.loaded()).toBe(false);
    service.download();
    expect(port.download).not.toHaveBeenCalled();
  });
  it('clears private state and cancels a pending download before another session can receive it', () => {
    port.latest.mockReturnValue(of(ok(ready)));
    const pending = new Subject<Result<Blob, AccountExportError>>();
    port.download.mockReturnValue(pending);
    const service = TestBed.inject(AccountExportEditorService);
    service.download();
    port.latest.mockReturnValue(of(ok(null)));
    token.next('bob');
    expect(pending.observed).toBe(false);
    pending.next(ok(new Blob(['private archive'])));
    expect(port.save).not.toHaveBeenCalled();
    expect(service.job()).toBeNull();
    expect(service.feedback()).toBe('');
  });
  it('cancels in-flight requests on sign-out and discards the previous session intent', () => {
    const pending = new Subject<Result<AccountExportJob, AccountExportError>>();
    port.request.mockReturnValue(pending);
    const service = TestBed.inject(AccountExportEditorService);
    service.request();
    token.next(null);
    pending.next(ok(ready));
    expect(service.job()).toBeNull();
    expect(service.signedIn()).toBe(false);
    token.next('bob');
    port.newKey.mockReturnValue('bob-intent');
    service.request();
    expect(port.request).toHaveBeenLastCalledWith('bob-intent');
  });
  it('removes a completed archive and stops polling terminal jobs', () => {
    port.latest.mockReturnValue(of(ok(ready)));
    const service = TestBed.inject(AccountExportEditorService);
    const cancelled = { ...queued, status: 'cancelled', attempts: 1 };
    port.cancel.mockReturnValue(of(ok(cancelled)));
    service.cancel();
    expect(port.cancel).toHaveBeenCalledWith(ready.id);
    expect(service.job()?.status).toBe('cancelled');
    jest.advanceTimersByTime(90_000);
    expect(port.latest).toHaveBeenCalledTimes(1);
    expect(service.canRequest()).toBe(true);
  });
  it('rechecks an archive at expiry and saves only a verified current-session download', () => {
    ready.expiresAt = Date.now() + 1000;
    port.latest.mockReturnValue(of(ok(ready)));
    port.download.mockReturnValue(of(ok(new Blob(['verified']))));
    const service = TestBed.inject(AccountExportEditorService);
    service.download();
    expect(port.save).toHaveBeenCalledTimes(1);
    port.latest.mockReturnValue(of(ok({ ...queued, status: 'expired' })));
    jest.advanceTimersByTime(1010);
    expect(service.job()?.status).toBe('expired');
    expect(service.canRequest()).toBe(true);
  });
});
