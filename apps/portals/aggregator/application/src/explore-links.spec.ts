import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import type { ExploreTarget } from '@domains/feed';
import { provideRouter, Router } from '@angular/router';
import { exploreLink } from './explore-links';
@Component({ template: '' })
class RoutedPage {}
describe('Explore links', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('opens the exact release version without double encoding', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const router = TestBed.inject(Router),
      version = '2026.10+explore';
    const link = exploreLink({
      kind: 'release',
      id: '10000000-0000-4000-8000-000000000001',
      applicationId: '10000000-0000-4000-8000-000000000002',
      applicationSlug: 'example',
      version,
    });
    const url = router.serializeUrl(
      router.createUrlTree(Array.isArray(link.path) ? link.path : [link.path])
    );
    expect(url).toBe('/apps/example/devlog/' + encodeURIComponent(version));
  });
  it('resolves every content kind from Digest to its root route', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'digest', component: RoutedPage }])],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/digest');
    const id = '10000000-0000-4000-8000-000000000001';
    const cases: [ExploreTarget, string][] = [
      [{ kind: 'application', id, slug: 'example' }, '/apps/example/overview'],
      [{ kind: 'suite', id }, '/suites/' + id],
      [{ kind: 'article', id, slug: 'story' }, '/articles/story'],
      [
        {
          kind: 'discussion',
          id,
          applicationId: id,
          applicationSlug: 'example',
        },
        '/apps/example/discussions/' + id,
      ],
      [
        { kind: 'review', id, applicationId: id, applicationSlug: 'example' },
        '/apps/example/review/' + id,
      ],
      [
        {
          kind: 'release',
          id,
          applicationId: id,
          applicationSlug: 'example',
          version: '1.0',
        },
        '/apps/example/devlog/1.0',
      ],
    ];
    for (const [target, expected] of cases) {
      const link = exploreLink(target);
      expect(
        router.serializeUrl(
          router.createUrlTree(
            Array.isArray(link.path) ? link.path : [link.path],
            { relativeTo: router.routerState.root.firstChild }
          )
        )
      ).toBe(expected);
    }
  });
});
