import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { ok, err, type Result } from '@sdk/kernel/standard';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  MY_DISCUSSIONS,
  type MyDiscussionsPort,
  type MyDiscussionView,
} from './application/my-discussions.port';
import { MyDiscussionsService } from './application/my-discussions.service';

const item: MyDiscussionView = {
  id: '10000000-0000-4000-8000-000000000001',
  applicationId: '10000000-0000-4000-8000-000000000002',
  title: 'Topic',
  createdAt: 1,
  replyCount: 3,
  participation: 'participant',
  applicationName: 'Application',
  applicationSlug: 'application',
};
const page = { items: [item], next: `1.${item.id}` };
type Page = { items: MyDiscussionView[]; next: string | null };

describe('My Discussions account state', () => {
  let port: jest.Mocked<MyDiscussionsPort>,
    token: BehaviorSubject<string | null>,
    service: MyDiscussionsService;
  beforeEach(() => {
    port = { list: jest.fn().mockReturnValue(of(ok(page))) };
    token = new BehaviorSubject<string | null>('Alice');
    TestBed.configureTestingModule({
      providers: [
        MyDiscussionsService,
        { provide: MY_DISCUSSIONS, useValue: port },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
      ],
    });
    service = TestBed.inject(MyDiscussionsService);
  });
  it('replaces pages, retains filtered-page continuation and resets latest paging', () => {
    expect(service.items()).toEqual([item]);
    port.list.mockReturnValue(of(ok({ items: [], next: `0.${item.id}` })));
    service.older();
    expect(port.list).toHaveBeenLastCalledWith(page.next);
    expect(service.items()).toEqual([]);
    expect(service.next()).toBe(`0.${item.id}`);
    expect(service.olderPage()).toBe(true);
    service.reload(true);
    expect(port.list).toHaveBeenLastCalledWith(null);
  });
  it('clears private entries immediately and cancels late results on account switch', () => {
    const late = new Subject<Result<Page, Error>>();
    port.list
      .mockReturnValueOnce(late)
      .mockReturnValue(of(ok({ items: [], next: null })));
    service.older();
    token.next('Bob');
    late.next(ok(page));
    expect(service.items()).toEqual([]);
    expect(service.next()).toBeNull();
    expect(service.olderPage()).toBe(false);
    token.next(null);
    const calls = port.list.mock.calls.length;
    service.reload();
    expect(port.list).toHaveBeenCalledTimes(calls);
    expect(service.signedIn()).toBe(false);
  });
  it('clears obsolete metadata on loading or failure and retries the same page', () => {
    port.list
      .mockReturnValueOnce(of(err(new Error('Still updating'))))
      .mockReturnValue(of(ok(page)));
    service.older();
    expect(service.items()).toEqual([]);
    expect(service.error()).toBe('Still updating');
    expect(service.next()).toBeNull();
    service.reload();
    expect(port.list).toHaveBeenLastCalledWith(page.next);
    expect(service.items()).toEqual([item]);
  });
  it('cancels older refreshes and handles synchronous port failure truthfully', () => {
    const late = new Subject<Result<Page, Error>>();
    port.list.mockReturnValueOnce(late).mockImplementationOnce(() => {
      throw new Error('Unavailable');
    });
    service.reload();
    expect(service.loading()).toBe(true);
    expect(service.items()).toEqual([]);
    service.reload();
    late.next(ok(page));
    expect(service.items()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toContain('could not be loaded');
  });
});
