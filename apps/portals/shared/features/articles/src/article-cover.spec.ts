import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { ArticleCoverUploadReceipt } from '@domains/catalog/media';
import { ArticleCoverService } from './application/article-cover.service';
import {
  ARTICLE_COVERS,
  ARTICLE_COVERS_RECOVERY,
  type ArticleCoverAttempt,
  type ArticleCoverPort,
  type ArticleCoverRecoveryPort,
} from './application/article-cover.port';
import {
  ARTICLE_SESSION,
  ArticleRequestError,
} from './application/article-workspace.port';
const articleId = '019a0010-0000-7000-8000-000000000001',
  id = '019a0010-0000-7000-8000-000000000002';
const source = {
  contentType: 'image/png' as const,
  bytes: 1,
  sha256: 'a'.repeat(64),
};
const file = new File(['a'], 'private-filename.png', {
  type: source.contentType,
});
const upload = {
  id,
  articleId,
  source,
  revision: 1,
  status: 'pending' as const,
  createdAt: 1,
  expiresAt: 86400001,
  asset: null,
};
const ready = {
  ...upload,
  revision: 2,
  status: 'ready' as const,
  asset: {
    id,
    contentType: 'image/webp' as const,
    bytes: 1,
    width: 1,
    height: 1,
    sha256: 'b'.repeat(64),
  },
};
describe('recoverable article cover uploads', () => {
  let session: BehaviorSubject<string | null>,
    port: jest.Mocked<ArticleCoverPort>,
    recovery: jest.Mocked<ArticleCoverRecoveryPort>,
    service: ArticleCoverService;
  let saved: ArticleCoverAttempt | null;
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
      preview: jest.fn(),
    };
    recovery = {
      restore: jest.fn().mockImplementation(() => of(ok(saved))),
      remember: jest.fn().mockImplementation((_session, value) => {
        saved = value;
        return of(ok(undefined));
      }),
      clear: jest.fn().mockImplementation(() => {
        saved = null;
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        ArticleCoverService,
        { provide: ARTICLE_COVERS, useValue: port },
        { provide: ARTICLE_COVERS_RECOVERY, useValue: recovery },
        {
          provide: ARTICLE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ArticleCoverService);
    service.open(articleId);
  });
  it('records retry intents before mutations and clears them only after durable success', fakeAsync(() => {
    port.reserve.mockImplementation(() => {
      expect(saved?.intent.type).toBe('reserve');
      return of(ok({ id, revision: 1, status: 'pending' as const }));
    });
    port.upload.mockImplementation(() => {
      expect(saved?.intent.type).toBe('upload');
      return of(ok({ id, revision: 2, status: 'ready' as const }));
    });
    service.select(file);
    flushMicrotasks();
    expect(port.reserve).toHaveBeenCalledWith(
      { articleId, source },
      expect.any(String)
    );
    expect(port.upload).toHaveBeenCalledWith(id, 1, file, expect.any(String));
    expect(saved).toBeNull();
    expect(service.pending()).toBeNull();
    expect(service.saving()).toBe(false);
    expect(service.feedback()).toContain('Upload confirmed');
  }));
  it('retries an uncertain upload with its exact key and refuses a different file', fakeAsync(() => {
    port.upload.mockReturnValueOnce(
      of(err(new ArticleRequestError('Unknown upload outcome', true, 503)))
    );
    service.select(file);
    flushMicrotasks();
    const key = port.upload.mock.calls[0][3];
    expect(saved?.key).toBe(key);
    port.inspect.mockReturnValueOnce(
      of(ok({ ...source, sha256: 'c'.repeat(64) }))
    );
    service.retry(file);
    flushMicrotasks();
    expect(port.upload).toHaveBeenCalledTimes(1);
    expect(service.error()).toContain('exact original file');
    service.retry(file);
    flushMicrotasks();
    expect(port.upload).toHaveBeenLastCalledWith(id, 1, file, key);
    expect(saved).toBeNull();
  }));
  it('blocks commands while retry storage is unavailable', fakeAsync(() => {
    recovery.remember.mockReturnValue(
      of(err(new Error('Storage unavailable')))
    );
    service.select(file);
    flushMicrotasks();
    expect(port.reserve).not.toHaveBeenCalled();
    expect(service.blocked()).toBe(true);
    expect(service.error()).toContain('Storage unavailable');
  }));
  it('resumes a restored upload only after the exact source file is reselected', fakeAsync(() => {
    saved = {
      key: 'restored',
      intent: { type: 'upload', articleId, id, source, expectedRevision: 1 },
    };
    service.restore();
    service.retry();
    flushMicrotasks();
    expect(port.upload).not.toHaveBeenCalled();
    expect(service.feedback()).toContain('exact original file');
    service.retry(file);
    flushMicrotasks();
    expect(port.upload).toHaveBeenCalledWith(id, 1, file, 'restored');
  }));
  it('keeps an in-flight reservation tied to its original article across navigation', fakeAsync(() => {
    const response = new Subject<Result<ArticleCoverUploadReceipt, Error>>();
    port.reserve.mockReturnValue(response);
    service.select(file);
    flushMicrotasks();
    service.open(id);
    response.next(ok({ id, revision: 1, status: 'pending' }));
    flushMicrotasks();
    expect(port.upload).toHaveBeenCalledWith(id, 1, file, expect.any(String));
    expect(port.list).toHaveBeenLastCalledWith(id);
    expect(
      recovery.remember.mock.calls
        .filter(([, attempt]) => attempt)
        .every(([, attempt]) => attempt?.intent.articleId === articleId)
    ).toBe(true);
  }));
  it('clears private state and fences late results when the account changes', fakeAsync(() => {
    const response = new Subject<Result<ArticleCoverUploadReceipt, Error>>();
    port.reserve.mockReturnValue(response);
    service.select(file);
    flushMicrotasks();
    session.next('bob');
    response.next(ok({ id, revision: 1, status: 'pending' }));
    flushMicrotasks();
    expect(port.upload).not.toHaveBeenCalled();
    expect(recovery.clear).toHaveBeenCalled();
    expect(service.items()).toEqual([]);
    expect(service.pending()).toBeNull();
    expect(service.feedback()).toBe('');
  }));
  it('reports referenced cancellation conflicts without claiming cleanup succeeded', fakeAsync(() => {
    port.cancel.mockReturnValue(
      of(err(new ArticleRequestError('Cover still referenced', false, 409)))
    );
    service.cancel(ready);
    flushMicrotasks();
    expect(service.error()).toBe('Cover still referenced');
    expect(service.feedback()).toBe('');
    expect(service.pending()).toBeNull();
  }));
  it('can resolve and cancel a lost reservation response without needing its source file', fakeAsync(() => {
    saved = {
      key: 'lost-reserve',
      intent: { type: 'reserve', articleId, input: { articleId, source } },
    };
    service.restore();
    service.cancelPendingUpload();
    flushMicrotasks();
    expect(port.reserve).toHaveBeenCalledWith(
      { articleId, source },
      'lost-reserve'
    );
    expect(port.cancel).toHaveBeenCalledWith(id, 2, expect.any(String));
    expect(saved).toBeNull();
  }));
});
