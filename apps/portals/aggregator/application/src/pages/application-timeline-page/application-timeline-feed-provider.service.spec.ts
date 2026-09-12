import { firstValueFrom } from 'rxjs';
import { APPLICATIONS, FEED_ITEM_EXAMPLES } from '@portals/shared/data';
import { ApplicationTimelineFeedProviderService, applicationTimelineItems } from './application-timeline-feed-provider.service';

describe('application timeline', () => {
  it('scopes and clones fixtures and builds absolute links', () => {
    const before = JSON.stringify(FEED_ITEM_EXAMPLES);
    const items = applicationTimelineItems('quick-task');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.appSlug === 'quick-task')).toBe(true);
    expect(items.every(i => i.appLink?.startsWith('/apps/quick-task'))).toBe(true);
    expect(JSON.stringify(FEED_ITEM_EXAMPLES)).toBe(before);
    expect(applicationTimelineItems('not-an-app')).toEqual([]);
  });
  it('terminates pagination without duplicates and resets for another app', async () => {
    const provider = new ApplicationTimelineFeedProviderService();
    provider.setApplication('quick-task');
    const ids: string[] = [];
    for (let page = 0; page < 20; page++) {
      const result = await firstValueFrom(provider.getFeedPage(page, 1));
      if (!result.ok) throw result.error;
      ids.push(...result.value.items.map(i => i.id));
      if (!result.value.hasMore) { expect(result.value.nextPage).toBeUndefined(); break; }
    }
    expect(ids.length).toBe(applicationTimelineItems('quick-task').length);
    expect(new Set(ids).size).toBe(ids.length);
    const exhausted = await firstValueFrom(provider.getFeedPage(100, 1));
    expect(exhausted).toMatchObject({ ok: true, value: { items: [], hasMore: false } });
    provider.setApplication(APPLICATIONS[0].slug);
    const changed = await firstValueFrom(provider.getFeedPage(0, 10));
    expect(changed.ok && changed.value.items.every(i => i.appSlug === APPLICATIONS[0].slug)).toBe(true);
    expect(await firstValueFrom(provider.getFeedPage(-1, 0))).toMatchObject({ ok: false });
  });
});

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RoutePathPipe } from '@ui/routing';

@Component({ standalone: true, template: '' })
class TimelineRouteTestComponent {}

it('resolves the review CTA from the timeline using the shared segment pipe', async () => {
  TestBed.configureTestingModule({ providers: [provideRouter([
    { path: 'apps/:appSlug/timeline', component: TimelineRouteTestComponent },
    { path: 'apps/:appSlug/reviews', component: TimelineRouteTestComponent }
  ])] });
  await RouterTestingHarness.create('/apps/photo-snap/timeline');
  const router = TestBed.inject(Router);
  const commands = new RoutePathPipe().transform('../reviews') as string[];
  const url = router.createUrlTree(commands, { relativeTo: router.routerState.root.firstChild! });
  expect(router.serializeUrl(url)).toBe('/apps/photo-snap/reviews');
});
