import { FeedAttributionComponent } from './feed-attribution.component';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FeedLocalVoteComponent } from './feed-local-vote.component';
import { FeedDatePipe } from './feed-date.pipe';
import { FeedActionsMenuComponent } from './feed-actions-menu.component';
import { DiscussionTopicFeedItemComponent } from '../feed-items/discussion-topic-feed-item.component';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { SharingService } from '@portals/shared/features/sharing';

describe('Feed actions and discussion preview', () => {
  afterEach(() => localStorage.removeItem('wapps.feed-vote.test-feed-item'));
  it('persists a named local vote and supports removing it', () => {
    const fixture = TestBed.createComponent(FeedLocalVoteComponent);
    fixture.componentRef.setInput('itemId', 'test-feed-item');
    fixture.componentRef.setInput('title', 'Design article');
    fixture.componentRef.setInput('upvotes', 5);
    fixture.detectChanges();
    const upvote: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(upvote.getAttribute('aria-label')).toBe('Upvote Design article locally');
    upvote.click(); fixture.detectChanges();
    expect(upvote.getAttribute('aria-pressed')).toBe('true');
    expect(upvote.textContent).toContain('6');
    expect(localStorage.getItem('wapps.feed-vote.test-feed-item')).toBe('1');
    upvote.click(); fixture.detectChanges();
    expect(upvote.getAttribute('aria-pressed')).toBe('false');
    expect(upvote.textContent).toContain('5');
  });
  it('formats fixture dates and gives an honest invalid-date fallback', () => {
    const pipe = TestBed.runInInjectionContext(() => new FeedDatePipe());
    expect(pipe.transform(new Date('2024-01-11T12:00:00Z'))).toContain('Jan 11, 2024');
    expect(pipe.transform('not-a-date')).toBe('Date unavailable');
    expect(pipe.transform(undefined)).toBe('Date unavailable');
  });
  it('hides empty menus and executes supplied menu actions', () => {
    const fixture = TestBed.createComponent(FeedActionsMenuComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('summary')).toBeNull();
    const action = jest.fn();
    fixture.componentRef.setInput('contextMenu', [{ label: 'Show details', action }]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('summary').click(); fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click(); fixture.detectChanges();
    expect(action).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('details').open).toBe(false);
  });
  it('exposes source and sponsorship details through a named disclosure', () => {
    const fixture = TestBed.createComponent(FeedAttributionComponent);
    fixture.componentRef.setInput('title', 'Design article');
    fixture.componentRef.setInput('attribution', { attributionType: 'human-created', contentNature: 'sponsored', sponsor: 'Design Studio', disclosureRequired: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('summary').getAttribute('aria-label')).toBe('Content attribution for Design article');
    expect(fixture.nativeElement.textContent).toContain('Sponsored by Design Studio');
    fixture.nativeElement.querySelector('summary').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('details').open).toBe(true);
    expect(fixture.nativeElement.querySelector('p').textContent).toContain('Human');
  });
  it('renders only actual messages with formatted dates and a working discussion URL', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: MyFavoritesService, useValue: { isFavorite$: () => of(false) } },
      { provide: SharingService, useValue: {} },
    ] });
    const fixture = TestBed.createComponent(DiscussionTopicFeedItemComponent);
    fixture.componentRef.setInput('item', {
      id: 'discussion-1', title: 'Quick Task', appSlug: 'quick-task', discussionSlug: 'collaboration',
      attribution: { attributionType: 'human-created', contentNature: 'organic', disclosureRequired: false },
      timestamp: new Date('2024-01-11T12:00:00Z'), participantsCount: 2, viewsCount: 10,
      discussionData: { topic: 'Collaboration', messages: [{ author: 'John Developer', content: 'A real fixture message.', timestamp: new Date('2024-01-11T12:00:00Z') }, null] },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('ui-discussion-post').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('A real fixture message.');
    expect(fixture.nativeElement.textContent).toContain('Jan 11, 2024');
    expect(fixture.nativeElement.textContent).not.toContain('Test Author');
    expect(fixture.nativeElement.textContent).not.toContain('GMT');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/apps/quick-task/discussions/collaboration');
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    expect(buttons.every(button => !!(button.getAttribute('aria-label') || button.textContent?.trim()))).toBe(true);
  });
});
