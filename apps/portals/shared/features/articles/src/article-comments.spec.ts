import { EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  PublicCommentPage,
  PublicCommentThread,
} from '@domains/discussion';
import { ArticleCommentsService } from './application/article-comments.service';
import {
  ARTICLE_COMMENTS,
  type ArticleCommentsPort,
  type ArticleCommentReceipt,
} from './application/article-comments.port';
import {
  ARTICLE_SESSION,
  ArticleRequestError,
} from './application/article-workspace.port';

const articleId = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const other = '10000000-0000-4000-8000-000000000003';
const content = { displayName: 'Public Alice', text: 'A considered comment.' };
const thread: PublicCommentThread = {
  id,
  revision: 1,
  replyCount: 0,
  comments: [
    {
      id,
      parentId: null,
      depth: 0,
      content,
      createdAt: 1,
      updatedAt: null,
      editable: true,
      removable: true,
    },
  ],
};
const receipt: ArticleCommentReceipt = {
  id,
  discussionId: id,
  revision: 1,
  projection: 'pending',
};

describe('article comment application state', () => {
  let port: jest.Mocked<ArticleCommentsPort>,
    session: BehaviorSubject<string | null>,
    service: ArticleCommentsService;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    port = {
      list: jest.fn().mockReturnValue(of(ok({ items: [thread], next: null }))),
      read: jest.fn().mockReturnValue(of(ok(thread))),
      change: jest.fn().mockReturnValue(of(ok(receipt))),
    };
    TestBed.configureTestingModule({
      providers: [
        ArticleCommentsService,
        { provide: ARTICLE_COMMENTS, useValue: port },
        {
          provide: ARTICLE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ArticleCommentsService);
  });
  it('opens a requested thread outside the listing and returns to the first page when the link is cleared', () => {
    service.open(articleId, id);
    expect(port.list).not.toHaveBeenCalled();
    expect(port.read).toHaveBeenCalledWith(articleId, id);
    expect(service.items()).toEqual([thread]);
    expect(service.expanded()).toEqual([id]);
    expect(service.next()).toBeNull();
    service.older();
    expect(port.read).toHaveBeenCalledTimes(1);
    service.open(articleId);
    expect(port.list).toHaveBeenLastCalledWith(articleId, null);
    expect(service.expanded()).toEqual([]);
  });
  it('rejects invalid thread links locally and reports missing or wrong-parent threads without a listing fallback', () => {
    for (const invalid of ['', 'invalid']) {
      service.open(articleId, invalid);
      expect(service.error()).toContain('link is invalid');
      expect(service.loading()).toBe(false);
      expect(port.read).not.toHaveBeenCalled();
    }
    port.read.mockReturnValue(
      of(err(new ArticleRequestError('Thread unavailable', false, 404)))
    );
    service.open(articleId, id);
    expect(service.error()).toBe('Thread unavailable');
    expect(service.items()).toEqual([]);
    expect(port.list).not.toHaveBeenCalled();
    port.read.mockReturnValue(of(ok(thread)));
    service.reload();
    expect(service.error()).toBe('');
    expect(service.items()).toEqual([thread]);
  });
  it.each(['thread', 'article', 'session', 'destroy'])(
    'cancels late direct-thread responses after a %s change',
    (change) => {
      const late = new Subject<Result<PublicCommentThread, Error>>();
      port.read.mockReturnValueOnce(late);
      service.open(articleId, id);
      expect(late.observed).toBe(true);
      port.read.mockReturnValue(of(err(new Error('No longer available'))));
      if (change === 'thread') service.open(articleId, other);
      else if (change === 'article') service.open(other, id);
      else if (change === 'session') session.next(null);
      else TestBed.resetTestingModule();
      expect(late.observed).toBe(false);
      late.next(ok(thread));
      expect(service.items()).toEqual([]);
      expect(service.expanded()).toEqual([]);
    }
  );
  it('reloads the requested thread after a mutation and retains truthful lag and deletion failures', () => {
    service.open(articleId, id);
    port.read.mockReturnValue(of(err(new Error('Public view still updating'))));
    service.change({
      type: 'edit',
      articleId,
      id,
      content,
      expectedRevision: 1,
    });
    expect(service.completed()).toBe(1);
    expect(service.feedback()).toContain('saved');
    expect(service.error()).toBe('Public view still updating');
    expect(service.items()).toEqual([]);
    expect(port.read).toHaveBeenLastCalledWith(articleId, id);
    expect(port.list).not.toHaveBeenCalled();
    port.read.mockReturnValue(of(err(new Error('Thread no longer available'))));
    service.reload(true);
    expect(service.error()).toBe('Thread no longer available');
    expect(service.next()).toBeNull();
  });
  it('retains an exact uncertain command across component destruction and never imports it into another account', () => {
    port.change.mockReturnValue(
      of(err(new ArticleRequestError('Unconfirmed', true)))
    );
    const injector = createEnvironmentInjector(
      [ArticleCommentsService],
      TestBed.inject(EnvironmentInjector)
    );
    const routed = injector.get(ArticleCommentsService);
    routed.open(articleId);
    const input = { ...content };
    routed.change({ type: 'create', articleId, content: input });
    input.text = 'Changed after dispatch';
    const original = port.change.mock.calls[0];
    injector.destroy();
    service.open(other);
    expect(service.pending()?.command).toEqual(original[0]);
    expect(service.pending()?.command).toMatchObject({ content });
    service.change({ type: 'create', articleId: other, content });
    expect(port.change).toHaveBeenCalledTimes(1);
    service.retry();
    expect(port.change.mock.calls[1]).toEqual(original);
    session.next('bob');
    expect(service.pending()).toBeNull();
    service.retry();
    expect(port.change).toHaveBeenCalledTimes(2);
  });
  it('clears definite conflicts without pretending the write completed', () => {
    port.change.mockReturnValue(
      of(err(new ArticleRequestError('Reload the thread', false, 409)))
    );
    service.open(articleId);
    service.change({
      type: 'edit',
      articleId,
      id,
      content,
      expectedRevision: 1,
    });
    expect(service.pending()).toBeNull();
    expect(service.completed()).toBe(0);
    expect(service.error()).toBe('Reload the thread');
  });
  it('reports acceptance separately from a delayed public projection', () => {
    service.open(articleId);
    port.list.mockReturnValue(of(err(new Error('Public view still updating'))));
    service.change({ type: 'create', articleId, content });
    expect(service.pending()).toBeNull();
    expect(service.completed()).toBe(1);
    expect(service.feedback()).toContain('saved');
    expect(service.feedback()).toContain('still be updating');
    expect(service.error()).toBe('Public view still updating');
    expect(service.items()).toEqual([]);
  });
  it('fences late reads and receipts after an account switch', () => {
    const lateRead = new Subject<Result<PublicCommentPage, Error>>();
    const lateWrite = new Subject<Result<ArticleCommentReceipt, Error>>();
    port.list.mockReturnValueOnce(lateRead);
    port.change.mockReturnValue(lateWrite);
    service.open(articleId);
    service.change({ type: 'create', articleId, content });
    port.list.mockReturnValue(of(ok({ items: [], next: null })));
    session.next(null);
    lateRead.next(ok({ items: [thread], next: null }));
    lateWrite.next(ok(receipt));
    expect(service.signedIn()).toBe(false);
    expect(service.items()).toEqual([]);
    expect(service.feedback()).toBe('');
    expect(service.completed()).toBe(0);
    expect(service.saving()).toBe(false);
    expect(service.pending()).toBeNull();
  });
  it('fences late article reads, preserves multiple opened threads and resets pagination on latest', () => {
    const late = new Subject<Result<PublicCommentPage, Error>>();
    port.list.mockReturnValueOnce(late);
    service.open(articleId);
    port.list.mockReturnValue(
      of(ok({ items: [thread, { ...thread, id: other }], next: `1.${id}` }))
    );
    service.open(other);
    late.next(ok({ items: [], next: null }));
    expect(service.items()).toHaveLength(2);
    service.expand(id);
    port.read.mockReturnValue(of(ok({ ...thread, id: other })));
    service.expand(other);
    expect(service.expanded()).toEqual([id, other]);
    service.older();
    expect(port.list).toHaveBeenLastCalledWith(other, `1.${id}`);
    expect(service.expanded()).toEqual([]);
    service.reload(true);
    expect(port.list).toHaveBeenLastCalledWith(other, null);
  });
  it('validates commands before retaining intent and never writes anonymously', () => {
    service.change({
      type: 'create',
      articleId,
      content: { ...content, text: '' },
    });
    expect(service.pending()).toBeNull();
    expect(port.change).not.toHaveBeenCalled();
    session.next(null);
    service.change({ type: 'create', articleId, content });
    expect(port.change).not.toHaveBeenCalled();
  });
});
