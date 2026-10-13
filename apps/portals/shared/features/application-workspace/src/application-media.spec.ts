import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  ApplicationImageSource,
  ApplicationImageUploadReceipt,
} from '@domains/catalog/media';
import { ApplicationMediaService } from './application/application-media.service';
import {
  APPLICATION_MEDIA,
  APPLICATION_MEDIA_RECOVERY,
  type ApplicationMediaAttempt,
  type ApplicationMediaPort,
  type ApplicationMediaRecoveryPort,
} from './application/application-media.port';
import {
  APPLICATION_WORKSPACE_SESSION,
  ApplicationDraftRequestError,
} from './application/application-drafts.port';

const draftId = '019a0010-0000-7000-8000-000000000001';
const id = '019a0010-0000-7000-8000-000000000002';
const source: ApplicationImageSource = {
  contentType: 'image/png',
  bytes: 1,
  sha256: 'a'.repeat(64),
};
const file = new File(['a'], 'private-name.png', { type: source.contentType });
const pending = {
  id,
  draftId,
  purpose: 'logo' as const,
  source,
  status: 'pending' as const,
  revision: 1,
  createdAt: 1,
  expiresAt: 86400001,
  asset: null,
};
const ready = {
  ...pending,
  status: 'ready' as const,
  revision: 2,
  asset: {
    id,
    purpose: 'logo' as const,
    contentType: 'image/webp' as const,
    width: 1,
    height: 1,
    bytes: 1,
    sha256: 'b'.repeat(64),
  },
};
const draft = {
  id: draftId,
  name: 'Private application',
  slug: 'private-application',
  website: 'https://example.test',
  description: 'An application with a private working draft.',
  revision: 3,
  createdAt: 1,
  updatedAt: 1,
  images: { logo: null, banner: null },
};

describe('recoverable application media workflow', () => {
  let session: BehaviorSubject<string | null>;
  let port: jest.Mocked<ApplicationMediaPort>;
  let recovery: jest.Mocked<ApplicationMediaRecoveryPort>;
  let saved: ApplicationMediaAttempt | null;
  let service: ApplicationMediaService;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    saved = null;
    port = {
      inspect: jest.fn().mockReturnValue(of(ok(source))),
      list: jest.fn().mockReturnValue(of(ok([]))),
      read: jest.fn().mockReturnValue(of(ok(ready))),
      reserve: jest
        .fn()
        .mockReturnValue(of(ok({ id, revision: 1, status: 'pending' }))),
      upload: jest
        .fn()
        .mockReturnValue(of(ok({ id, revision: 2, status: 'ready' }))),
      cancel: jest
        .fn()
        .mockReturnValue(of(ok({ id, revision: 2, status: 'cancelled' }))),
      attach: jest
        .fn()
        .mockReturnValue(of(ok({ id: draftId, revision: 4, deleted: false }))),
      preview: jest.fn(),
    };
    recovery = {
      restore: jest.fn().mockImplementation(() => of(ok(saved))),
      remember: jest.fn().mockImplementation((_session, attempt) => {
        saved = attempt;
        return of(ok(undefined));
      }),
      clear: jest.fn().mockImplementation(() => {
        saved = null;
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        ApplicationMediaService,
        { provide: APPLICATION_MEDIA, useValue: port },
        { provide: APPLICATION_MEDIA_RECOVERY, useValue: recovery },
        {
          provide: APPLICATION_WORKSPACE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ApplicationMediaService);
    service.open(draftId);
  });
  it('persists each exact command before sending it and keeps uploading separate from attachment', fakeAsync(() => {
    port.reserve.mockImplementation(() => {
      expect(saved?.intent.type).toBe('reserve');
      return of(ok({ id, revision: 1, status: 'pending' as const }));
    });
    port.upload.mockImplementation(() => {
      expect(saved?.intent.type).toBe('upload');
      return of(ok({ id, revision: 2, status: 'ready' as const }));
    });
    service.select(file, 'logo');
    flushMicrotasks();
    expect(port.reserve).toHaveBeenCalledTimes(1);
    expect(port.upload).toHaveBeenCalledWith(id, 1, file, expect.any(String));
    expect(port.attach).not.toHaveBeenCalled();
    expect(service.pending()).toBeNull();
    expect(saved).toBeNull();
    expect(service.feedback()).toContain('Choose Use image');
  }));
  it('retains a lost reservation response and retries the same intent across routes', fakeAsync(() => {
    port.reserve.mockReturnValueOnce(
      of(err(new ApplicationDraftRequestError(true, 'unconfirmed')))
    );
    service.select(file, 'logo');
    flushMicrotasks();
    const first = port.reserve.mock.calls[0];
    expect(saved?.intent.type).toBe('reserve');
    service.open(id);
    service.retry();
    flushMicrotasks();
    expect(port.reserve.mock.calls[1]).toEqual(first);
    expect(port.upload.mock.calls[0][0]).toBe(id);
    expect(port.list.mock.calls.at(-1)).toEqual([id]);
  }));
  it('recovers an upload after reload with the original key and refuses a different file', fakeAsync(() => {
    port.upload.mockReturnValueOnce(
      of(err(new ApplicationDraftRequestError(true, 'lost upload response')))
    );
    service.select(file, 'logo');
    flushMicrotasks();
    const key = port.upload.mock.calls[0][3];
    const reopened = TestBed.runInInjectionContext(
      () => new ApplicationMediaService()
    );
    reopened.open(draftId);
    reopened.retry();
    flushMicrotasks();
    expect(port.upload).toHaveBeenCalledTimes(1);
    expect(reopened.feedback()).toContain('exact original');
    port.inspect.mockReturnValueOnce(
      of(ok({ ...source, sha256: 'c'.repeat(64) }))
    );
    reopened.retry(file);
    flushMicrotasks();
    expect(reopened.error()).toContain('exact original');
    expect(port.upload).toHaveBeenCalledTimes(1);
    reopened.retry(file);
    flushMicrotasks();
    expect(port.upload.mock.calls[1][3]).toBe(key);
    expect(reopened.pending()).toBeNull();
  }));
  it('does no server mutation when retry metadata cannot be retained', fakeAsync(() => {
    recovery.remember.mockReturnValue(of(err(new Error('storage disabled'))));
    service.select(file, 'logo');
    flushMicrotasks();
    expect(port.reserve).not.toHaveBeenCalled();
    expect(port.upload).not.toHaveBeenCalled();
    expect(service.error()).toBe('storage disabled');
    expect(service.pending()).not.toBeNull();
  }));
  it('keeps a committed request retryable when clearing local recovery fails', fakeAsync(() => {
    recovery.remember.mockImplementation((_scope, attempt) =>
      attempt ? of(ok(undefined)) : of(err(new Error('storage unavailable')))
    );
    service.attach(draft, 'logo', id);
    flushMicrotasks();
    const key = port.attach.mock.calls[0][2];
    expect(service.pending()?.intent.type).toBe('attach');
    recovery.remember.mockReturnValue(of(ok(undefined)));
    service.retry();
    flushMicrotasks();
    expect(port.attach.mock.calls[1][2]).toBe(key);
    expect(service.pending()).toBeNull();
  }));
  it('binds attachments and cancellation to the loaded authoritative revisions', fakeAsync(() => {
    const changed = jest.fn();
    service.changed.subscribe(changed);
    service.attach(draft, 'logo', id);
    flushMicrotasks();
    expect(port.attach).toHaveBeenCalledWith(
      draftId,
      { expectedRevision: 3, purpose: 'logo', imageId: id },
      expect.any(String)
    );
    expect(changed).toHaveBeenCalledWith({
      id: draftId,
      revision: 4,
      deleted: false,
    });
    service.cancel(ready);
    flushMicrotasks();
    expect(port.cancel).toHaveBeenCalledWith(id, 2, expect.any(String));
  }));
  it('clears definitive conflicts without pretending that cancellation or attachment succeeded', fakeAsync(() => {
    port.cancel.mockReturnValue(
      of(err(new ApplicationDraftRequestError(false, 'still referenced', 409)))
    );
    service.cancel(ready);
    flushMicrotasks();
    expect(service.pending()).toBeNull();
    expect(saved).toBeNull();
    expect(service.error()).toBe('still referenced');
    expect(service.feedback()).toBe('');
  }));
  it('can cancel an uncertain upload without the original file using current server state', fakeAsync(() => {
    saved = {
      key: 'previous-key',
      intent: { type: 'upload', draftId, id, expectedRevision: 1, source },
    };
    service.restore();
    port.read.mockReturnValue(of(ok(ready)));
    service.cancelPendingUpload();
    flushMicrotasks();
    expect(port.upload).not.toHaveBeenCalled();
    expect(port.cancel.mock.calls[0][1]).toBe(2);
    expect(saved).toBeNull();
  }));
  it('resolves an uncertain reservation with its original key before cancelling it', fakeAsync(() => {
    port.read.mockReturnValue(of(ok(pending)));
    saved = {
      key: 'reservation-key',
      intent: {
        type: 'reserve',
        draftId,
        input: { draftId, purpose: 'logo', source },
      },
    };
    service.restore();
    service.cancelPendingUpload();
    flushMicrotasks();
    expect(port.reserve.mock.calls[0][1]).toBe('reservation-key');
    expect(port.cancel).toHaveBeenCalledWith(id, 1, expect.any(String));
    expect(port.upload).not.toHaveBeenCalled();
  }));
  it('blocks competing changes and discards obsolete responses on account switch', fakeAsync(() => {
    const reserve = new Subject<Result<ApplicationImageUploadReceipt, Error>>();
    port.reserve.mockReturnValue(reserve);
    service.select(file, 'logo');
    flushMicrotasks();
    service.select(file, 'banner');
    service.attach(draft, 'logo', id);
    expect(port.reserve).toHaveBeenCalledTimes(1);
    expect(port.attach).not.toHaveBeenCalled();
    session.next('bob');
    reserve.next(ok({ id, revision: 1, status: 'pending' }));
    flushMicrotasks();
    expect(port.upload).not.toHaveBeenCalled();
    expect(service.saving()).toBe(false);
    expect(recovery.clear).toHaveBeenCalledTimes(1);
    expect(service.pending()).toBeNull();
    expect(saved).toBeNull();
  }));
  it('never begins a reservation after the account changes during file inspection', fakeAsync(() => {
    const inspected = new Subject<Result<ApplicationImageSource, Error>>();
    port.inspect.mockReturnValue(inspected);
    service.select(file, 'logo');
    session.next(null);
    inspected.next(ok(source));
    flushMicrotasks();
    expect(port.reserve).not.toHaveBeenCalled();
    expect(service.pending()).toBeNull();
  }));
  it('does not present a historical ready receipt as a currently usable upload', fakeAsync(() => {
    port.read.mockReturnValue(
      of(ok({ ...pending, status: 'cancelled' as const, revision: 3 }))
    );
    service.select(file, 'logo');
    flushMicrotasks();
    expect(service.feedback()).toContain('no longer ready');
    expect(service.pending()).toBeNull();
  }));
  it('retains an upload retry if its current availability cannot be checked', fakeAsync(() => {
    port.read.mockReturnValueOnce(
      of(err(new ApplicationDraftRequestError(false, 'unavailable', 503)))
    );
    service.select(file, 'logo');
    flushMicrotasks();
    expect(service.pending()?.intent.type).toBe('upload');
    const key = port.upload.mock.calls[0][3];
    service.retry();
    flushMicrotasks();
    expect(port.upload.mock.calls[1][3]).toBe(key);
    expect(service.pending()).toBeNull();
    expect(service.feedback()).toContain('Upload confirmed');
  }));
  it('loads retained uploads without treating an unavailable list as empty success', () => {
    port.list.mockReturnValue(of(err(new Error('offline'))));
    service.reload();
    expect(service.listError()).toBe('offline');
    expect(service.loading()).toBe(false);
    service.error.set('unconfirmed mutation');
    port.list.mockReturnValue(of(ok([])));
    service.reload();
    expect(service.listError()).toBe('');
    expect(service.error()).toBe('unconfirmed mutation');
  });
  it.each(['reserve', 'upload'] as const)(
    'clears a pending %s only after canonical absence is confirmed',
    fakeAsync((type: 'reserve' | 'upload') => {
      saved = {
        key: 'original-key',
        intent:
          type === 'reserve'
            ? { type, draftId, input: { draftId, purpose: 'logo', source } }
            : { type, draftId, id, expectedRevision: 1, source },
      };
      service.restore();
      const request = type === 'reserve' ? port.reserve : port.read;
      request.mockReturnValueOnce(
        of(err(new ApplicationDraftRequestError(true, 'offline')))
      );
      service.cancelPendingUpload();
      flushMicrotasks();
      expect(saved).not.toBeNull();
      expect(service.error()).toBe('offline');
      request.mockReturnValueOnce(
        of(err(new ApplicationDraftRequestError(false, 'gone', 404)))
      );
      service.cancelPendingUpload();
      flushMicrotasks();
      expect(service.pending()).toBeNull();
      expect(saved).toBeNull();
      expect(port.cancel).not.toHaveBeenCalled();
      expect(service.feedback()).toContain('no longer accessible');
    })
  );
});
