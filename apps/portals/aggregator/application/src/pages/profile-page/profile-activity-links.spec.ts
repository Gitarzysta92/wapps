import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { PublicProfilePageComponent } from './public-profile-page.component';

describe('public activity route serialization', () => {
  afterEach(() => TestBed.resetTestingModule());
  it.each(['2026.10+activity', 'v1.0-beta_2'])(
    'opens the exact release version %s',
    (version) => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const router = TestBed.inject(Router);
      const commands = PublicProfilePageComponent.prototype.activityPath({
        kind: 'release',
        id: '00000000-0000-4000-8000-000000000001',
        title: 'A release',
        at: 100,
        target: {
          kind: 'release',
          id: '00000000-0000-4000-8000-000000000001',
          applicationSlug: 'public-app',
          version,
        },
      });
      const url = router.serializeUrl(
        router.createUrlTree(Array.isArray(commands) ? commands : [commands])
      );
      expect(url).toBe(
        `/apps/public-app/devlog/${encodeURIComponent(version)}`
      );
      expect(
        router.parseUrl(url).root.children['primary'].segments[3].path
      ).toBe(version);
    }
  );
});
