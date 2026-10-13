import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type {
  PublicApplicationDiscussion,
  PublicApplicationDiscussionPage,
} from '@domains/discussion';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  APPLICATION_DISCUSSIONS,
  type ApplicationDiscussionsPort,
} from './application/application-discussions.port';
import { ApplicationDiscussionsService } from './application/application-discussions.service';
import { ApplicationDiscussionPreviewsComponent } from './presentation/application-discussion-previews.component';

const applicationId = '10000000-0000-4000-8000-000000000001';
const otherApplication = '10000000-0000-4000-8000-000000000002';
const thread = (suffix: number): PublicApplicationDiscussion => {
  const id = `20000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
  return {
    id,
    title: `Public topic ${suffix}`,
    tags: [],
    pinned: suffix === 1,
    canPin: false,
    revision: 1,
    replyCount: suffix,
    comments: [
      {
        id,
        parentId: null,
        depth: 0,
        content: { displayName: 'Chosen name', text: 'Public content.' },
        createdAt: 1,
        updatedAt: null,
        editable: false,
        removable: false,
      },
    ],
  };
};
const items = [1, 2, 3, 4, 5].map(thread);

describe('canonical application discussion previews', () => {
  let port: jest.Mocked<ApplicationDiscussionsPort>;
  let session: BehaviorSubject<string | null>;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>(null);
    port = {
      list: jest.fn().mockReturnValue(of(ok({ items, next: 'older' }))),
      read: jest.fn().mockReturnValue(of(ok(items[0]))),
      change: jest.fn(),
    };
    TestBed.configureTestingModule({
      imports: [ApplicationDiscussionPreviewsComponent],
      providers: [
        provideRouter([]),
        ApplicationDiscussionsService,
        { provide: APPLICATION_DISCUSSIONS, useValue: port },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: session, getToken: () => session.value },
        },
      ],
    });
  });
  function create(excludeId: string | null = null) {
    const fixture = TestBed.createComponent(
      ApplicationDiscussionPreviewsComponent
    );
    fixture.componentRef.setInput('applicationId', applicationId);
    fixture.componentRef.setInput('excludeId', excludeId);
    fixture.componentRef.setInput(
      'threadLink',
      (id: string) => `/apps/real-app/discussions/${id}`
    );
    fixture.detectChanges();
    return fixture;
  }

  it('shows three ordered public previews and canonical links, excluding the current thread', () => {
    const fixture = create(items[2].id);
    const root: HTMLElement = fixture.nativeElement;
    expect(
      Array.from(root.querySelectorAll('article')).map(
        (node) => node.dataset['threadId']
      )
    ).toEqual([items[0].id, items[1].id, items[3].id]);
    expect(root.querySelector('a')?.getAttribute('href')).toBe(
      `/apps/real-app/discussions/${items[0].id}`
    );
    expect(root.textContent).toContain('Pinned discussion');
    expect(root.textContent).toContain('Chosen name');
    expect(root.textContent).toContain('including removed posts');
    expect(root.textContent).not.toMatch(/\d+\s+views\b/);
    expect(port.list).toHaveBeenCalledTimes(1);
    expect(port.list).toHaveBeenCalledWith(applicationId, null);
    fixture.componentRef.setInput('excludeId', items[0].id);
    fixture.detectChanges();
    expect(root.querySelector('article')?.getAttribute('data-thread-id')).toBe(
      items[1].id
    );
    expect(port.list).toHaveBeenCalledTimes(2);
  });

  it('keeps loading and failure distinct from empty, and reloads without displaying old previews', () => {
    const fixture = create();
    const root: HTMLElement = fixture.nativeElement;
    const pending = new Subject<
      Result<PublicApplicationDiscussionPage, Error>
    >();
    port.list.mockReturnValue(pending);
    root.querySelector('button')?.click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Loading discussion previews');
    expect(root.querySelector('article')).toBeNull();
    expect(root.textContent).not.toContain('No discussions yet');
    pending.next(err(new Error('Projection pending.')));
    fixture.detectChanges();
    expect(root.textContent).toContain('Discussion previews unavailable');
    expect(root.textContent).not.toContain('No discussions yet');
    port.list.mockReturnValue(of(ok({ items: [], next: null })));
    root.querySelector('button')?.click();
    fixture.detectChanges();
    expect(root.textContent).toContain('No discussions yet.');
    expect(root.textContent).not.toContain('unavailable');
  });

  it('cancels stale application and session reads without leaking earlier names', () => {
    const first = new Subject<Result<PublicApplicationDiscussionPage, Error>>();
    const next = new Subject<Result<PublicApplicationDiscussionPage, Error>>();
    port.list.mockReturnValueOnce(first).mockReturnValue(next);
    const fixture = create();
    fixture.componentRef.setInput('applicationId', otherApplication);
    fixture.detectChanges();
    first.next(ok({ items, next: null }));
    fixture.detectChanges();
    expect(fixture.componentInstance.items()).toEqual([]);
    next.next(ok({ items, next: null }));
    fixture.detectChanges();
    expect(fixture.componentInstance.items()).toHaveLength(3);
    session.next('another-account');
    fixture.detectChanges();
    expect(fixture.componentInstance.items()).toEqual([]);
    expect(port.list).toHaveBeenLastCalledWith(otherApplication, null);
  });

  it('isolates preview loading from the routed thread and refreshes after accepted mutations', () => {
    const routed = TestBed.inject(ApplicationDiscussionsService);
    routed.open(applicationId, items[0].id);
    const fixture = create(items[0].id);
    expect(fixture.componentInstance.discussions).not.toBe(routed);
    expect(routed.items()).toEqual([items[0]]);
    fixture.componentRef.setInput('refreshRevision', 2);
    fixture.detectChanges();
    expect(port.list).toHaveBeenCalledTimes(2);
    expect(routed.items()).toEqual([items[0]]);
    expect(port.change).not.toHaveBeenCalled();
  });
});
