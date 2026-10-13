import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { ReplyInboxPage } from '@domains/discussion';
import { AUTHENTICATION_SESSION } from './authentication-session.port';
import { REPLY_INBOX } from './reply-inbox.port';
import { ReplyInboxService } from './reply-inbox.service';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const item = {
  id: id(2),
  discussionId: id(1),
  target: { kind: 'article' as const, id: id(3) },
  title: 'Current article',
  slug: 'current-article',
  at: 100,
  readAt: null,
};
const page: ReplyInboxPage = {
  enabled: true,
  items: [item],
  next: `100.${id(2)}`,
};
describe('private reply inbox state', () => {
  let token: BehaviorSubject<string | null>;
  const port = { list: jest.fn(), markRead: jest.fn() };
  beforeEach(() => {
    jest.resetAllMocks();
    token = new BehaviorSubject<string | null>('alice');
    port.list.mockReturnValue(of(ok(page)));
    port.markRead.mockReturnValue(of(ok({ id: item.id, readAt: 200 })));
    TestBed.configureTestingModule({
      providers: [
        ReplyInboxService,
        { provide: REPLY_INBOX, useValue: port },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
      ],
    });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('loads the current page and replaces it with bounded older results', () => {
    const service = TestBed.inject(ReplyInboxService);
    expect(service.items()).toEqual([item]);
    port.list.mockReturnValue(of(ok({ enabled: true, items: [], next: null })));
    service.older();
    expect(port.list).toHaveBeenLastCalledWith(page.next);
    expect(service.items()).toEqual([]);
    expect(service.olderPage()).toBe(true);
    service.reload(true);
    expect(port.list).toHaveBeenLastCalledWith(null);
    expect(service.olderPage()).toBe(false);
  });
  it('clears private rows and pending reads on sign-out and a new account', () => {
    const pending = new Subject<
      Result<{ id: string; readAt: number }, Error>
    >();
    const service = TestBed.inject(ReplyInboxService);
    port.markRead.mockReturnValue(pending);
    service.markRead(item.id);
    expect(service.reading()).toBe(item.id);
    token.next(null);
    expect(pending.observed).toBe(false);
    expect(service.items()).toEqual([]);
    expect(service.reading()).toBeNull();
    port.list.mockReturnValue(of(ok({ enabled: true, items: [], next: null })));
    token.next('bob');
    pending.next(ok({ id: item.id, readAt: 200 }));
    expect(service.items()).toEqual([]);
    expect(service.feedback()).toBe('');
    expect(port.list).toHaveBeenLastCalledWith(null);
  });
  it('cancels obsolete loads and ignores their eventual values and errors', () => {
    const old = new Subject<Result<ReplyInboxPage, Error>>();
    port.list.mockReturnValueOnce(old);
    const service = TestBed.inject(ReplyInboxService);
    expect(service.loading()).toBe(true);
    port.list.mockReturnValue(
      of(ok({ enabled: false, items: [], next: null }))
    );
    token.next('bob');
    expect(old.observed).toBe(false);
    old.next(ok(page));
    old.error(new Error('old account failure'));
    expect(service.enabled()).toBe(false);
    expect(service.items()).toEqual([]);
    expect(service.error()).toBe('');
  });
  it('hides cached content after a failed reload and supports explicit retry', () => {
    const service = TestBed.inject(ReplyInboxService);
    port.list.mockReturnValueOnce(of(err(new Error('Unavailable'))));
    service.reload();
    expect(service.items()).toEqual([]);
    expect(service.error()).toBe('Unavailable');
    service.reload();
    expect(service.items()).toEqual([item]);
    expect(service.error()).toBe('');
  });
  it('does not send guest, duplicate or foreign-row read mutations', () => {
    const service = TestBed.inject(ReplyInboxService);
    service.markRead(id(9));
    expect(port.markRead).not.toHaveBeenCalled();
    service.markRead(item.id);
    expect(service.items()[0].readAt).toBe(200);
    service.markRead(item.id);
    expect(port.markRead).toHaveBeenCalledTimes(1);
    token.next(null);
    service.markRead(item.id);
    expect(port.markRead).toHaveBeenCalledTimes(1);
  });
  it('does not pretend a lost or mismatched read receipt succeeded', () => {
    const service = TestBed.inject(ReplyInboxService);
    port.markRead.mockReturnValueOnce(of(err(new Error('Uncertain receipt'))));
    service.markRead(item.id);
    expect(service.error()).toBe('Uncertain receipt');
    expect(service.items()).toEqual([]);
    service.reload();
    port.markRead.mockReturnValueOnce(of(ok({ id: id(9), readAt: 200 })));
    service.markRead(item.id);
    expect(service.error()).toContain('incomplete');
    expect(service.feedback()).toBe('');
  });
  it('shows opt-out without stale notifications or paging', () => {
    const service = TestBed.inject(ReplyInboxService);
    port.list.mockReturnValue(
      of(ok({ enabled: false, items: [], next: null }))
    );
    service.reload();
    expect(service.enabled()).toBe(false);
    expect(service.next()).toBeNull();
    expect(service.items()).toEqual([]);
  });
});
