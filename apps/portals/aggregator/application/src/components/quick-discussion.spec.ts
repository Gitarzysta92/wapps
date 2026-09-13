import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { randomUUID } from 'node:crypto';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { LOCAL_APPLICATION_DATA, LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { QuickDiscussionDialogComponent, QuickDiscussionButtonComponent, QuickDiscussionService, LocalDiscussionReplyComponent } from '@portals/shared/features/discussion';
import { DiscussionTopicFeedItemComponent } from '@portals/shared/features/feed';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { SharingService } from '@portals/shared/features/sharing';
import { of } from 'rxjs';
import { FEED_ITEM_EXAMPLES } from '@portals/shared/data';
import type { DiscussionTopicFeedItem } from '@domains/feed';

const appSlug = 'photo-snap';
const discussionSlug = 'how-to-integrate-with-external-apis';

async function createDialog(slug = discussionSlug, application = appSlug, localMode = true) {
  TestBed.configureTestingModule({
    imports: [QuickDiscussionDialogComponent, QuickDiscussionButtonComponent],
    providers: [provideRouter([]), provideNoopAnimations(),
      { provide: LOCAL_APPLICATION_DATA, useValue: localMode },
      { provide: POLYMORPHEUS_CONTEXT, useValue: { data: { appSlug: application, discussionSlug: slug }, completeWith: jest.fn() } },
      { provide: QuickDiscussionService, useValue: { open: jest.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(QuickDiscussionDialogComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

const originalUuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
beforeAll(() => {
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID });
});
afterAll(() => {
  if (originalUuid) Object.defineProperty(crypto, 'randomUUID', originalUuid);
  else Reflect.deleteProperty(crypto, 'randomUUID');
});
beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

async function openReply(fixture: ComponentFixture<QuickDiscussionDialogComponent>, index = 0) {
  const control = fixture.debugElement.queryAll(By.directive(LocalDiscussionReplyComponent))[index];
  control.nativeElement.querySelector('button').click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return control.componentInstance as LocalDiscussionReplyComponent;
}

it('reads the thread and opens a validated editor under the selected reply', async () => {
  const fixture = await createDialog();
  const thread = fixture.nativeElement.querySelector('ui-discussion-thread');
  expect(thread.querySelectorAll('ui-discussion-post[role="article"]')).toHaveLength(3);
  expect(fixture.nativeElement.querySelector('form')).toBeNull();
  const editor = await openReply(fixture, 1);
  const post = thread.querySelectorAll('ui-discussion-post')[1];
  expect(post.querySelector('form')).not.toBeNull();
  expect(post.querySelector('textarea').getAttribute('aria-describedby')).toContain(editor.post().id);
  expect(post.querySelector('label').textContent).toContain('Mike Johnson');
  expect(fixture.nativeElement.textContent).not.toContain('Value is invalid');
  const save = jest.spyOn(TestBed.inject(LocalDiscussionsService), 'reply');
  for (const content of [null, '   ', 'a'.repeat(5001)]) {
    editor.edit(content);
    editor.saveReply();
    expect(editor.canSubmit()).toBe(false);
  }
  expect(save).not.toHaveBeenCalled();
});

it('persists the selected parent from the form and refreshes the feed counter', async () => {
  const fixture = await createDialog();
  const editor = await openReply(fixture, 1);
  const parentId = editor.post().id;
  const button = TestBed.createComponent(QuickDiscussionButtonComponent);
  button.componentRef.setInput('appSlug', appSlug);
  button.componentRef.setInput('discussionSlug', discussionSlug);
  button.detectChanges();
  expect(button.componentInstance.count()).toBe(2);
  const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
  textarea.value = '  A helpful local reply.  ';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges(); await fixture.whenStable();
  fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  button.detectChanges();
  expect(fixture.nativeElement.querySelector('form')).toBeNull();
  expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Reply saved');
  expect(fixture.nativeElement.textContent).toContain('In reply to Mike Johnson');
  expect(button.componentInstance.count()).toBe(3);
  const persisted = new LocalDiscussionsService().threads(appSlug).find(thread => thread.slug === discussionSlug)!;
  expect(persisted.replies.at(-1)).toMatchObject({ content: 'A helpful local reply.', replyToId: parentId });
  expect(new LocalDiscussionsService().threads('quick-task')).toHaveLength(0);
  button.nativeElement.querySelector('button').click();
  expect(TestBed.inject(QuickDiscussionService).open).toHaveBeenCalledWith({ appSlug, discussionSlug });
});

it('keeps drafts attached to their posts when switching, and clears only a cancelled draft', async () => {
  const fixture = await createDialog();
  const first = await openReply(fixture);
  first.edit('Reply for Sarah.');
  const second = await openReply(fixture, 1);
  second.edit('Reply for Mike.');
  expect(first.expanded()).toBe(false);
  expect(fixture.nativeElement.querySelectorAll('form')).toHaveLength(1);
  await openReply(fixture);
  expect(fixture.nativeElement.querySelector('textarea').value).toBe('Reply for Sarah.');
  fixture.nativeElement.querySelector('.composer-actions button[type="button"]').click();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('form')).toBeNull();
  await openReply(fixture);
  expect(first.draft()).toBe('');
  await openReply(fixture, 1);
  expect(second.draft()).toBe('Reply for Mike.');
});

it('retains the draft and target on storage failure, then saves only once on retry', async () => {
  const fixture = await createDialog();
  const editor = await openReply(fixture, 2);
  editor.edit('Keep this reply.');
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Quota exceeded'); });
  editor.saveReply(); fixture.detectChanges();
  expect(editor.draft()).toBe('Keep this reply.');
  expect(editor.expanded()).toBe(true);
  expect(fixture.componentInstance.thread()?.replies).toHaveLength(2);
  expect(fixture.nativeElement.textContent).toContain('Could not save on this device');
  write.mockRestore();
  editor.saveReply(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(fixture.componentInstance.thread()?.replies).toHaveLength(3);
  expect(fixture.componentInstance.thread()?.replies.at(-1)?.replyToId).toBe(editor.post().id);
  expect(editor.saveError()).toBe('');
});

it('opens only the requested thread and saves a reply to its opening post', async () => {
  const fixture = await createDialog('oauth-implementation');
  expect(fixture.nativeElement.querySelector('h3').textContent).toBe('OAuth Implementation Best Practices');
  expect(fixture.nativeElement.textContent).not.toContain('All discussions');
  expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/apps/photo-snap/discussions/oauth-implementation');
  const editor = await openReply(fixture);
  editor.edit('Only for the OAuth thread.'); editor.saveReply();
  const threads = new LocalDiscussionsService().threads(appSlug);
  expect(threads.find(thread => thread.slug === 'oauth-implementation')?.replies.at(-1)).toMatchObject({ content: 'Only for the OAuth thread.', replyToId: editor.post().id });
  expect(threads.find(thread => thread.slug === discussionSlug)?.replies).toHaveLength(2);
});

it('rejects a reply to a post from another thread without writing', () => {
  const data = new LocalDiscussionsService();
  const other = data.threads(appSlug).find(thread => thread.slug === 'oauth-implementation')!;
  const write = jest.spyOn(Storage.prototype, 'setItem');
  expect(() => data.reply(appSlug, discussionSlug, 'Wrong target', other.id)).toThrow('Reply target not found');
  expect(write).not.toHaveBeenCalled();
});

it.each([[discussionSlug, 'quick-task'], ['missing-thread', appSlug]])('does not fall back to other threads for %s in %s', async (slug, application) => {
  const fixture = await createDialog(slug, application);
  expect(fixture.nativeElement.textContent).toContain('Discussion not found');
  expect(fixture.nativeElement.querySelector('form')).toBeNull();
  expect(fixture.nativeElement.querySelector('a')).toBeNull();
  fixture.nativeElement.querySelector('button').click();
  expect(fixture.componentInstance.context.completeWith).toHaveBeenCalled();
});

it('does not offer local submission when local data is disabled', async () => {
  const fixture = await createDialog(discussionSlug, appSlug, false);
  expect(fixture.nativeElement.querySelector('ui-discussion-reply-button, form')).toBeNull();
  expect(fixture.componentInstance.thread()?.replies).toHaveLength(2);
});

const snapshot = FEED_ITEM_EXAMPLES.find(item => item.id === 'discussion-topic-1') as DiscussionTopicFeedItem;

function createPreview(slug = discussionSlug, messages: unknown[] = snapshot.discussionData.messages) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(),
    { provide: QuickDiscussionService, useValue: { open: jest.fn() } },
    { provide: MyFavoritesService, useValue: { isFavorite$: () => of(false) } },
    { provide: SharingService, useValue: {} },
  ] });
  const fixture = TestBed.createComponent(DiscussionTopicFeedItemComponent);
  fixture.componentRef.setInput('item', {
    id: 'discussion-preview', type: 'discussion-topic-feed-item', title: 'Photo Snap', subtitle: '',
    appSlug, discussionSlug: slug, timestamp: new Date('2024-01-11'), participantsCount: 2, viewsCount: 10,
    topicLink: `/apps/${appSlug}/discussions/${slug}`, contextMenu: [],
    discussionData: { topic: 'Conversation', messages },
  });
  fixture.detectChanges();
  return fixture;
}

it('keeps the selected snapshot before and after local replies, including when the tile is recreated', () => {
  new LocalDiscussionsService().reply(appSlug, discussionSlug, 'An existing local comment must not replace the snapshot.');
  const fixture = createPreview();
  const data = TestBed.inject(LocalDiscussionsService);
  const preview = fixture.nativeElement.querySelector('ui-discussion-thread');
  expect(preview.querySelectorAll('ui-discussion-post')).toHaveLength(3);
  expect(preview.querySelector('[slot="opening-post"] .author-name').textContent).toBe('Sarah Chen');
  expect(preview.querySelector('img').getAttribute('src')).toBe(snapshot.discussionData.messages[0].authorAvatarUrl);
  expect(preview.textContent).toContain('Mike Johnson');
  expect(preview.textContent).toContain('Emma Wilson');
  expect(preview.textContent).not.toContain('existing local comment');
  const messagesBefore = fixture.componentInstance.messages();
  const headerBefore = fixture.nativeElement.querySelector('ui-card-header').textContent;

  data.reply(appSlug, discussionSlug, 'The newest reply stays in the full conversation.');
  fixture.detectChanges();
  expect(fixture.componentInstance.messages()).toEqual(messagesBefore);
  expect(fixture.nativeElement.querySelector('ui-card-header').textContent).toBe(headerBefore);
  expect(preview.textContent).not.toContain('The newest reply');
  expect(data.threads(appSlug).find(thread => thread.slug === discussionSlug)?.replies.at(-1)?.content).toBe('The newest reply stays in the full conversation.');
  const trigger = fixture.nativeElement.querySelector('discussion-quick-button button');
  expect(trigger.textContent.trim()).toBe('4');
  trigger.click();
  expect(TestBed.inject(QuickDiscussionService).open).toHaveBeenCalledWith({ appSlug, discussionSlug });

  // Reopening a feed uses the stored/transported snapshot, including serialized dates.
  const item = JSON.parse(JSON.stringify(fixture.componentInstance.item));
  fixture.destroy();
  const reopened = TestBed.createComponent(DiscussionTopicFeedItemComponent);
  reopened.componentRef.setInput('item', item);
  reopened.detectChanges();
  expect(reopened.componentInstance.messages()).toEqual(messagesBefore);
  expect(reopened.nativeElement.querySelector('discussion-quick-button button').textContent.trim()).toBe('4');
});

it('preserves the supplied selection and excerpt text instead of replacing it with a live-thread slice', () => {
  const content = 'Selected context. '.repeat(20) + 'The significant conclusion stays visible.';
  const fixture = createPreview(discussionSlug, [{ id: 'selected-answer', author: 'Selected author', content }]);
  const preview = fixture.nativeElement.querySelector('ui-discussion-thread');
  expect(preview.querySelectorAll('ui-discussion-post')).toHaveLength(1);
  expect(preview.textContent).toContain('Selected author');
  expect(preview.textContent).toContain(content);
  expect(preview.textContent).not.toContain('Sarah Chen');
});

it('uses shared posts for legacy previews without inventing dates or rendering malformed entries', () => {
  const fixture = createPreview('legacy-preview', [
    { author: 'Alex', content: 'A message without a date.' }, null,
    { author: 'Sam', content: 'A message with an invalid date.', timestamp: 'invalid' },
    { content: 123 },
  ]);
  const preview = fixture.nativeElement.querySelector('ui-discussion-thread');
  expect(preview.querySelectorAll('ui-discussion-post')).toHaveLength(2);
  expect(preview.textContent).toContain('A message without a date.');
  expect(preview.querySelectorAll('.published-time')).toHaveLength(0);
});

it.each([discussionSlug, 'missing-thread'])('does not fill an empty snapshot from the live thread %s', (slug) => {
  const fixture = createPreview(slug, [null, {}]);
  expect(fixture.nativeElement.querySelector('ui-discussion-thread')).toBeNull();
  expect(fixture.nativeElement.textContent).toContain('No messages are available in this preview.');
});
