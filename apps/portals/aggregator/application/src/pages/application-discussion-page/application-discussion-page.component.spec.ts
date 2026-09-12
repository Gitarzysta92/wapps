import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { LOCAL_APPLICATION_DATA } from '@portals/shared/features/application-overview';
import { ApplicationDiscussionPageComponent } from './application-discussion-page.component';

it('uses working local replies without legacy controls and preserves draft text after storage failure', async () => {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [{ provide: LOCAL_APPLICATION_DATA, useValue: true }] });
  TestBed.overrideComponent(ApplicationDiscussionPageComponent, { set: { imports: [CommonModule, FormsModule], schemas: [NO_ERRORS_SCHEMA] } });
  await TestBed.compileComponents();
  const fixture = TestBed.createComponent(ApplicationDiscussionPageComponent);
  fixture.componentRef.setInput('appSlug', 'photo-snap');
  fixture.componentRef.setInput('discussionSlug', 'how-to-integrate-with-external-apis');
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('ui-discussion-voting-button, ui-discussion-reply-button')).toBeNull();
  const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
    .find(item => item.textContent?.includes('Reply locally'))!;
  button.click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  const draft = 'Keep this reply if saving fails.';
  fixture.componentInstance.replyContent = draft;
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  const count = fixture.componentInstance.discussion.value()!.replies.length;
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
  try {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.componentInstance.replyContent).toBe(draft);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Could not save');
    expect(fixture.componentInstance.discussion.value()!.replies.length).toBe(count);
  } finally { write.mockRestore(); }
});
