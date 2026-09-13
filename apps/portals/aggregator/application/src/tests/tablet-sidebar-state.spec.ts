import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GlobalStateService } from '../state/global-state.service';

@Component({ template: '' })
class Page {}

describe('Tablet sidebar navigation', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [
      GlobalStateService,
      provideRouter([
        { path: 'blocked', component: Page, canActivate: [() => false] },
        { path: '**', component: Page },
      ]),
    ],
  }));

  it('opens one panel at a time and allows the active panel to collapse', () => {
    const state = TestBed.inject(GlobalStateService);
    state.toggleLeftSidebar();
    expect(state.isLeftSidebarExpanded$.value).toBe(true);
    state.toggleRightSidebar();
    expect(state.isLeftSidebarExpanded$.value).toBe(false);
    expect(state.isRightSidebarExpanded$.value).toBe(true);
    state.toggleLeftSidebar();
    expect(state.isRightSidebarExpanded$.value).toBe(false);
    state.toggleLeftSidebar();
    expect(state.isLeftSidebarExpanded$.value).toBe(false);
  });

  it('reveals the destination after successful navigation, including reused pages', async () => {
    const state = TestBed.inject(GlobalStateService);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    state.toggleLeftSidebar();
    await router.navigateByUrl('/discover');
    expect(state.isLeftSidebarExpanded$.value).toBe(false);
    state.toggleRightSidebar();
    await router.navigateByUrl('/discover?search=photo');
    expect(state.isRightSidebarExpanded$.value).toBe(false);
  });

  it('keeps the panel available when navigation is blocked', async () => {
    const state = TestBed.inject(GlobalStateService);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    state.toggleRightSidebar();
    expect(await router.navigateByUrl('/blocked')).toBe(false);
    expect(state.isRightSidebarExpanded$.value).toBe(true);
  });
});
