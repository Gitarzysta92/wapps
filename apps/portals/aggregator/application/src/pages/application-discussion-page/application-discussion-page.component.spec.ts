import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { randomUUID } from 'node:crypto';
import { LOCAL_APPLICATION_DATA, LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { LocalDiscussionReplyComponent } from '@portals/shared/features/discussion';
import { ApplicationDiscussionPageComponent } from './application-discussion-page.component';

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

async function createPage() {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(), { provide: LOCAL_APPLICATION_DATA, useValue: true }] });
  const fixture = TestBed.createComponent(ApplicationDiscussionPageComponent);
  fixture.componentRef.setInput('appSlug', 'photo-snap');
  fixture.componentRef.setInput('discussionSlug', 'how-to-integrate-with-external-apis');
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  return fixture;
}

it('opens beneath the selected entry and preserves the draft and target after a storage failure', async () => {
  const fixture = await createPage();
  const post = fixture.nativeElement.querySelectorAll('.discussion-content-section ui-discussion-post')[1];
  post.querySelector('button').click();
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(fixture.nativeElement.querySelectorAll('form')).toHaveLength(1);
  expect(post.querySelector('form')).not.toBeNull();
  expect(post.querySelector('label').textContent).toContain('Mike Johnson');
  const draft = 'Keep this reply if saving fails.';
  const textarea = post.querySelector('textarea');
  textarea.value = draft;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges(); await fixture.whenStable();
  const count = fixture.componentInstance.discussion.value()!.replies.length;
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Quota exceeded'); });
  post.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(post.querySelector('textarea').value).toBe(draft);
  expect(post.textContent).toContain('Could not save');
  expect(fixture.componentInstance.discussion.value()!.replies.length).toBe(count);
  write.mockRestore();
  const editor = fixture.debugElement.queryAll(By.directive(LocalDiscussionReplyComponent))[1].componentInstance as LocalDiscussionReplyComponent;
  editor.saveReply(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('form')).toBeNull();
  expect(fixture.nativeElement.textContent).toContain('In reply to Mike Johnson');
  const thread = new LocalDiscussionsService().threads('photo-snap').find(t => t.slug === 'how-to-integrate-with-external-apis')!;
  expect(thread.replies.at(-1)).toMatchObject({ content: draft, replyToId: thread.replies[0].id });
});

it('switches a single editor between posts and clears it when the route changes', async () => {
  const fixture = await createPage();
  const posts = fixture.nativeElement.querySelectorAll('.discussion-content-section ui-discussion-post');
  posts[0].querySelector('button').click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  posts[1].querySelector('button').click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(posts[0].querySelector('form')).toBeNull();
  expect(posts[1].querySelector('form')).not.toBeNull();
  fixture.componentRef.setInput('discussionSlug', 'oauth-implementation');
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('form')).toBeNull();
  const opening = fixture.nativeElement.querySelector('.discussion-content-section ui-discussion-post');
  opening.querySelector('button').click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(opening.querySelector('label').textContent).toContain('Alex Turner');
  expect(opening.querySelector('textarea').value).toBe('');
});
