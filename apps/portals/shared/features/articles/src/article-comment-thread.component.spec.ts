import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, of } from 'rxjs';
import { ok } from '@sdk/kernel/standard';
import { ArticleCommentsService } from './application/article-comments.service';
import { ArticleCommentsComponent } from './presentation/article-comments.component';
import { ARTICLE_COMMENTS } from './application/article-comments.port';
import { ARTICLE_SESSION } from './application/article-workspace.port';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { MENTION_MEMBERS } from '@portals/shared/features/user-profile';

describe('article thread composer', () => {
  it('requires an explicit reply or edit on a linked thread and exposes new threads only in the all-threads view', () => {
    const articleId = '10000000-0000-4000-8000-000000000001';
    const id = '10000000-0000-4000-8000-000000000002';
    const thread = {
      id,
      revision: 1,
      replyCount: 0,
      comments: [
        {
          id,
          parentId: null,
          depth: 0,
          content: { displayName: 'Member', text: 'Root comment' },
          createdAt: 1,
          updatedAt: null,
          editable: true,
          removable: true,
        },
      ],
    };
    const port = {
      read: jest.fn().mockReturnValue(of(ok(thread))),
      list: jest.fn().mockReturnValue(of(ok({ items: [thread], next: null }))),
      change: jest
        .fn()
        .mockReturnValue(
          of(ok({ id, discussionId: id, revision: 2, projection: 'pending' }))
        ),
    };
    TestBed.configureTestingModule({
      imports: [ArticleCommentsComponent],
      providers: [
        provideNoopAnimations(),
        ArticleCommentsService,
        {
          provide: AUTHENTICATION_SESSION,
          useValue: {
            token$: new BehaviorSubject('Member'),
            getToken: () => 'Member',
          },
        },
        {
          provide: MENTION_MEMBERS,
          useValue: {
            directory: () => of(ok({ items: [], after: null })),
            read: () => of(ok(null)),
          },
        },
        { provide: ARTICLE_COMMENTS, useValue: port },
        {
          provide: ARTICLE_SESSION,
          useValue: {
            key$: new BehaviorSubject('Member'),
            currentKey: () => 'Member',
          },
        },
      ],
    }).overrideComponent(ArticleCommentsComponent, { set: { providers: [] } });
    const fixture = TestBed.createComponent(ArticleCommentsComponent);
    fixture.componentRef.setInput('articleId', articleId);
    fixture.componentRef.setInput('threadId', id);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance;
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).toContain('Choose Reply');
    expect(host.textContent).not.toContain('Latest comments');
    component.submit();
    expect(port.change).not.toHaveBeenCalled();
    component.select('reply', thread.comments[0], thread);
    fixture.detectChanges();
    expect(host.querySelector('form')).not.toBeNull();
    expect(host.textContent).toContain('Cancel reply or edit');
    component.name.set('Member');
    component.text.set('A reply');
    component.submit();
    expect(port.change).toHaveBeenLastCalledWith(
      {
        type: 'reply',
        articleId,
        id,
        content: { displayName: 'Member', text: 'A reply' },
      },
      expect.any(String)
    );
    fixture.detectChanges();
    expect(host.querySelector('form')).toBeNull();
    fixture.componentRef.setInput('threadId', null);
    fixture.detectChanges();
    expect(host.querySelector('form')).not.toBeNull();
    expect(host.textContent).toContain('Latest comments');
    component.name.set('Member');
    component.text.set('A new thread');
    component.submit();
    expect(port.change).toHaveBeenLastCalledWith(
      {
        type: 'create',
        articleId,
        content: { displayName: 'Member', text: 'A new thread' },
      },
      expect.any(String)
    );
  });
});
