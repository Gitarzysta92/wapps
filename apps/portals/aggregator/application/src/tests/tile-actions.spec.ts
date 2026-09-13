import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { SharingService } from '@portals/shared/features/sharing';
import { DiscussionTopicFeedItemComponent } from '@portals/shared/features/feed';

describe('Projected tile actions', () => {
  it('keeps one working favorite, share and menu control after the tile content', () => {
    const favorite = new BehaviorSubject(false);
    const favorites = {
      isFavorite$: () => favorite,
      addToFavorites: jest.fn(() => { favorite.next(true); return of({ ok: true }); }),
      removeFromFavorites: jest.fn(() => { favorite.next(false); return of({ ok: true }); }),
    };
    const url = 'http://localhost/apps/quick-task/discussions/collaboration';
    const sharing = { canShare: () => false, contentUrl: jest.fn(() => url) };
    const moreAction = jest.fn();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: MyFavoritesService, useValue: favorites },
      { provide: SharingService, useValue: sharing },
    ] });
    const fixture = TestBed.createComponent(DiscussionTopicFeedItemComponent);
    fixture.componentRef.setInput('item', {
      id: 'discussion-1', title: 'Quick Task', appSlug: 'quick-task', discussionSlug: 'collaboration',
      timestamp: new Date('2024-01-11'), participantsCount: 2, viewsCount: 10,
      discussionData: { topic: 'Collaboration', messages: [] },
      contextMenu: [{ label: 'Inspect discussion', action: moreAction }],
    });
    fixture.detectChanges();
    const card: HTMLElement = fixture.nativeElement.querySelector('ui-medium-card');
    const actions = card.querySelector<HTMLElement>('.card-actions-content')!;
    expect(actions.closest('.card-toolbar')).not.toBeNull();
    expect(card.querySelector('ui-card-header button')).toBeNull();
    expect(card.querySelectorAll('favorite-toggle-button')).toHaveLength(1);
    const toggle = actions.querySelector<HTMLButtonElement>('favorite-toggle-button button')!;
    toggle.click(); fixture.detectChanges();
    expect(favorites.addToFavorites).toHaveBeenCalledWith('discussions', 'collaboration');
    expect(favorites.addToFavorites).toHaveBeenCalledTimes(1);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click(); fixture.detectChanges();
    expect(favorites.removeFromFavorites).toHaveBeenCalledTimes(1);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    actions.querySelector<HTMLButtonElement>('share-toggle-button button')!.click();
    fixture.detectChanges();
    expect(sharing.contentUrl).toHaveBeenCalledTimes(1);
    expect(actions.querySelector<HTMLInputElement>('share-toggle-button input')!.value).toBe(url);

    actions.querySelector<HTMLElement>('summary')!.click();
    actions.querySelector<HTMLButtonElement>('feed-actions-menu button')!.click();
    fixture.detectChanges();
    expect(moreAction).toHaveBeenCalledTimes(1);
    expect(actions.querySelector<HTMLDetailsElement>('details')!.open).toBe(false);
    expect(card.querySelector('.card-body a')).toBeNull();
    expect(actions.querySelector('a')!.getAttribute('href')).toBe('/apps/quick-task/discussions/collaboration');
  });
});
