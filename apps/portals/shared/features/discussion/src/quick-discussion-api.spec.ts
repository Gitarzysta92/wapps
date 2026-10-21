import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  PublicContentPreferencesService,
  type PublicContentChoice,
} from '@portals/shared/features/preferences';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { ok, err, type Result } from '@sdk/kernel/standard';
import type { PublicApplicationDiscussion } from '@domains/community';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { MENTION_MEMBERS } from '@portals/shared/features/user-profile';
import {
  APPLICATION_OVERVIEW_PROVIDER,
  LOCAL_APPLICATION_DATA,
  LOCAL_DISCUSSION_DRAFTS,
  type OverviewDto,
} from '@portals/shared/features/application-overview';
import {
  APPLICATION_DISCUSSIONS,
  DiscussionRequestError,
  type ApplicationDiscussionsPort,
} from './application/application-discussions.port';
import { QuickDiscussionApiDialogComponent } from './presentation/quick-discussion/quick-discussion-api-dialog.component';
import { QuickDiscussionButtonComponent } from './presentation/quick-discussion/quick-discussion-button.component';
import { QuickDiscussionService } from './presentation/quick-discussion/quick-discussion.service';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';

const applicationId = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const app: OverviewDto = {
  id: applicationId,
  revision: 1,
  classification: 'general',
  slug: 'current-app',
  name: 'Current App',
  description: null,
  website: null,
  logo: null,
  banner: null,
  isPwa: false,
  listingDate: null,
  updateDate: null,
  platforms: [],
  monetizations: [],
  categories: [],
  tags: [],
  estimatedUsers: null,
  reviews: null,
  includedSuites: null,
};
const thread: PublicApplicationDiscussion = {
  pinned: false,
  canPin: false,
  id,
  revision: 2,
  title: 'Real discussion',
  tags: [],
  replyCount: 0,
  comments: [
    {
      id,
      parentId: null,
      depth: 0,
      content: { displayName: 'Public Alice', text: 'A real topic.' },
      createdAt: 1,
      updatedAt: null,
      editable: true,
      removable: true,
    },
  ],
};

describe('API quick discussion composition', () => {
  const choice = signal<PublicContentChoice>({
    status: 'ready',
    sessionKey: 'Alice',
    sessionVersion: 1,
    showMatureContent: false,
  });
  let port: jest.Mocked<ApplicationDiscussionsPort>,
    token: BehaviorSubject<string | null>,
    overview: jest.Mock,
    fixture: ComponentFixture<QuickDiscussionApiDialogComponent>;
  const localRead = jest.fn(() => {
    throw new Error('Demo read in API mode');
  });
  beforeEach(() => {
    choice.set({
      status: 'ready',
      sessionKey: 'Alice',
      sessionVersion: 1,
      showMatureContent: false,
    });
    token = new BehaviorSubject<string | null>('Alice');
    port = {
      list: jest.fn(),
      read: jest.fn().mockReturnValue(of(ok(thread))),
      change: jest
        .fn()
        .mockReturnValue(
          of(err(new DiscussionRequestError('Unconfirmed', true)))
        ),
    };
    overview = jest.fn().mockReturnValue(of(ok(app)));
    TestBed.configureTestingModule({
      imports: [
        QuickDiscussionApiDialogComponent,
        QuickDiscussionButtonComponent,
      ],
      providers: [
        {
          provide: PublicContentPreferencesService,
          useValue: { state: choice, reload: jest.fn() },
        },
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: MyFavoritesService,
          useValue: {
            mode: 'api',
            supports: () => true,
            myFavorites$: of({
              sessionVersion: 1,
              signedIn: false,
              context: null,
            }),
            isFavorite$: () => of(false),
          },
        },
        { provide: APPLICATION_DISCUSSIONS, useValue: port },
        {
          provide: MENTION_MEMBERS,
          useValue: {
            directory: () => of(ok({ items: [], after: null })),
            read: () => of(ok(null)),
          },
        },
        {
          provide: APPLICATION_OVERVIEW_PROVIDER,
          useValue: { getOverview: overview },
        },
        { provide: LOCAL_APPLICATION_DATA, useValue: false },
        { provide: LOCAL_DISCUSSION_DRAFTS, useValue: { threads: localRead } },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
        {
          provide: POLYMORPHEUS_CONTEXT,
          useValue: {
            data: { appSlug: 'current-app', discussionSlug: id },
            completeWith: jest.fn(),
          },
        },
        {
          provide: QuickDiscussionService,
          useValue: { open: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    });
  });
  async function render() {
    fixture = TestBed.createComponent(QuickDiscussionApiDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function enter(selector: string, value: string) {
    const field = fixture.nativeElement.querySelector(selector);
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }
  async function submit() {
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  it('resolves canonical application identity, reuses real thread reads and has independent field IDs', async () => {
    await render();
    expect(overview).toHaveBeenCalledWith('current-app');
    expect(port.read).toHaveBeenCalledWith(applicationId, id);
    expect(fixture.nativeElement.textContent).toContain('A real topic.');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe(
      `/apps/current-app/discussions/${id}`
    );
    expect(
      fixture.nativeElement.querySelector('label').getAttribute('for')
    ).toBe('quick-discussion-name');
    expect(
      fixture.nativeElement.querySelector('#quick-discussion-text')
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('#application-discussion-text')
    ).toBeNull();
    expect(localRead).not.toHaveBeenCalled();
  });
  it('retains the exact uncertain command across dialog destruction and reopening', async () => {
    await render();
    enter('#quick-discussion-name', 'Public Alice');
    enter('#quick-discussion-text', 'Retained modal reply.');
    await submit();
    const original = port.change.mock.calls[0];
    expect(original[0]).toEqual({
      type: 'reply',
      applicationId,
      id,
      content: { displayName: 'Public Alice', text: 'Retained modal reply.' },
    });
    fixture.destroy();
    await render();
    expect(fixture.nativeElement.textContent).toContain(
      'Resolve the last discussion request'
    );
    fixture.componentInstance.discussions.retry();
    expect(port.change.mock.calls[1]).toEqual(original);
    token.next('Bob');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.discussions.pending()).toBeNull();
    expect(
      fixture.nativeElement.querySelector('#quick-discussion-text').value
    ).toBe('');
  });
  it('retains typed edits on a definite conflict and clears them on account change', async () => {
    await render();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    const edit = buttons.find(
      (button) => button.textContent?.trim() === 'Edit post'
    );
    if (!edit) throw new Error('Edit control is missing');
    edit.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    enter('#quick-discussion-text', 'My conflicting revision.');
    port.change.mockReturnValue(
      of(err(new DiscussionRequestError('Reload the thread', false, 409)))
    );
    await submit();
    expect(port.change.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        type: 'edit',
        expectedRevision: thread.revision,
        content: expect.objectContaining({ text: 'My conflicting revision.' }),
      })
    );
    expect(
      fixture.nativeElement.querySelector('#quick-discussion-text').value
    ).toBe('My conflicting revision.');
    expect(
      fixture.nativeElement.querySelector('#quick-discussion-title')
    ).not.toBeNull();
    token.next(null);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
  it('fences late reads after the modal is destroyed', async () => {
    const late = new Subject<Result<PublicApplicationDiscussion, Error>>();
    port.read.mockReturnValue(late);
    await render();
    const service = fixture.componentInstance.discussions;
    fixture.destroy();
    late.next(ok(thread));
    expect(service.items()).toEqual([]);
  });
  it('reports unavailable application metadata without fetching or falling back to local threads', async () => {
    overview.mockReturnValue(of(err(new Error('Catalog unavailable'))));
    await render();
    expect(fixture.nativeElement.textContent).toContain(
      'Application unavailable'
    );
    expect(port.read).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(localRead).not.toHaveBeenCalled();
  });
  it('clears the dialog title, messages and composer when the parent becomes hidden', async () => {
    overview.mockReturnValue(of(ok({ ...app, classification: 'mature' })));
    choice.set({ ...choice(), showMatureContent: true });
    await render();
    expect(fixture.nativeElement.textContent).toContain('Real discussion');
    const late = new Subject<Result<PublicApplicationDiscussion, Error>>();
    port.read.mockReturnValue(late);
    fixture.componentInstance.discussions.reload();
    choice.set({ ...choice(), showMatureContent: false });
    expect(fixture.componentInstance.title()).toBe('Discussion');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(late.observed).toBe(false);
    late.next(ok(thread));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Application hidden');
    expect(fixture.nativeElement.textContent).not.toContain('Real discussion');
    expect(fixture.nativeElement.textContent).not.toContain('A real topic.');
    expect(fixture.nativeElement.textContent).not.toContain('Current App');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.componentInstance.discussions.items()).toEqual([]);
  });
  it('uses supplied real counters and never invents zero or reads local counters in API mode', async () => {
    const button = TestBed.createComponent(QuickDiscussionButtonComponent);
    button.componentRef.setInput('appSlug', app.slug);
    button.componentRef.setInput('discussionSlug', id);
    button.detectChanges();
    expect(button.componentInstance.count()).toBeNull();
    expect(button.nativeElement.textContent).toContain('Quick discussion');
    for (const value of [-1, NaN, 2000]) {
      button.componentRef.setInput('replyCount', value);
      button.detectChanges();
      expect(button.componentInstance.count()).toBeNull();
    }
    button.componentRef.setInput('replyCount', 3);
    button.componentRef.setInput('topicTitle', 'Real discussion');
    button.detectChanges();
    expect(button.componentInstance.label()).toBe(
      'Read and comment: Real discussion (3 replies)'
    );
    const closed = jest.fn();
    button.componentInstance.closed.subscribe(closed);
    await button.componentInstance.open();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(localRead).not.toHaveBeenCalled();
  });
});
