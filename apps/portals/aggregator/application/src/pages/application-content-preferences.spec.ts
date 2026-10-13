import { Component, input, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { ok } from '@sdk/kernel/standard';
import {
  APPLICATION_OVERVIEW_PROVIDER,
  type ApplicationContentReader,
  type OverviewDto,
} from '@portals/shared/features/application-overview';
import {
  PublicContentPreferencesService,
  type PublicContentChoice,
} from '@portals/shared/features/preferences';
import {
  ApplicationDiscussionsComponent,
  ApplicationDiscussionPreviewsComponent,
  ApplicationDiscussionsService,
} from '@portals/shared/features/discussion';
import {
  MemberReviewsComponent,
  ReviewsService,
} from '@portals/shared/features/review';
import { ReleaseCatalogService } from '@portals/shared/features/application-workspace';
import { ApplicationHealthService } from '@apps/portals/shared/features/health-status';
import { ApplicationTimelineService } from '@portals/shared/features/feed';
import { ApplicationDiscussionsApiPageComponent } from './application-discussions-page/application-discussions-api-page.component';
import { ApplicationReviewsApiPageComponent } from './application-reviews-page/application-reviews-api-page.component';
import { ReleaseDevlogPageComponent } from './releases/release-devlog.component';
import { ApplicationHealthApiPageComponent } from './application-health-page/application-health-api-page.component';
import { ApplicationTimelineApiPageComponent } from './application-timeline-page/application-timeline-api-page.component';

@Component({
  selector: 'application-discussions',
  template: 'Child discussion content',
})
class DiscussionsStub {
  readonly applicationId = input<string>();
  readonly applicationSlug = input<string>();
  readonly threadId = input<string | null>();
  readonly threadLink = input<(id: string) => string>();
}
@Component({ selector: 'application-discussion-previews', template: '' })
class PreviewsStub {
  readonly applicationId = input<string>();
  readonly excludeId = input<string | null>();
  readonly refreshRevision = input<number>();
  readonly threadLink = input<(id: string) => string>();
}
@Component({ selector: 'member-reviews', template: 'Child review content' })
class ReviewsStub {
  readonly detail = input<boolean>();
  readonly reviewLink = input<(id: string) => string>();
}

const application: OverviewDto = {
  id: '10000000-0000-4000-8000-000000000001',
  revision: 1,
  slug: 'example',
  name: 'Classified application',
  classification: 'mature',
  description: null,
  website: null,
  logo: null,
  banner: null,
  isPwa: false,
  listingDate: null,
  updateDate: null,
  platforms: [],
  monetizations: [],
  categories: [],
  tags: [],
  estimatedUsers: null,
  reviews: null,
  includedSuites: null,
};

const pages: {
  name: string;
  component: Type<{ app: ApplicationContentReader }>;
  service: Type<unknown>;
  kind: 'id' | 'slug';
}[] = [
  {
    name: 'discussions',
    component: ApplicationDiscussionsApiPageComponent,
    service: ApplicationDiscussionsService,
    kind: 'id',
  },
  {
    name: 'reviews',
    component: ApplicationReviewsApiPageComponent,
    service: ReviewsService,
    kind: 'id',
  },
  {
    name: 'devlog',
    component: ReleaseDevlogPageComponent,
    service: ReleaseCatalogService,
    kind: 'slug',
  },
  {
    name: 'health',
    component: ApplicationHealthApiPageComponent,
    service: ApplicationHealthService,
    kind: 'slug',
  },
  {
    name: 'timeline',
    component: ApplicationTimelineApiPageComponent,
    service: ApplicationTimelineService,
    kind: 'slug',
  },
];

describe.each(pages)(
  '$name parent content preferences',
  ({ name, component, service, kind }) => {
    it('clears parent metadata and child composition on preference failure, account change and hidden classification', async () => {
      const choice = signal<PublicContentChoice>({
        status: 'ready',
        sessionKey: 'Alice',
        sessionVersion: 1,
        showMatureContent: true,
      });
      const reload = jest.fn();
      const child = {
        // Deliberately retain stale child state; the parent template must mask it.
        items: signal([]),
        loading: signal(false),
        error: signal(''),
        accepted: signal(null),
        missing: signal(false),
        total: signal(0),
        previous: signal([]),
        previousTotal: signal(0),
        pageSize: 20,
        previousLoading: signal(false),
        previousError: signal(''),
        report: signal({ application, monitors: [] }),
        status: signal('unknown'),
        application: signal(application),
        notFound: signal(false),
        order: signal('recent'),
        personalizationDisabled: signal(false),
        loaded: signal(false),
        after: signal(null),
        open: jest.fn(),
        close: jest.fn(),
        reload: jest.fn(),
        retry: jest.fn(),
      };
      TestBed.configureTestingModule({
        providers: [
          provideRouter(
            [
              {
                path: 'apps/:appSlug/:section',
                component,
                data: { breadcrumb: [] },
              },
            ],
            withComponentInputBinding()
          ),
          provideNoopAnimations(),
          {
            provide: APPLICATION_OVERVIEW_PROVIDER,
            useValue: { getOverview: () => of(ok(application)) },
          },
          {
            provide: PublicContentPreferencesService,
            useValue: { state: choice, reload },
          },
        ],
      });
      TestBed.overrideComponent(component, {
        set: { providers: [{ provide: service, useValue: child }] },
      });
      if (component === ApplicationDiscussionsApiPageComponent)
        TestBed.overrideComponent(component, {
          remove: {
            imports: [
              ApplicationDiscussionsComponent,
              ApplicationDiscussionPreviewsComponent,
            ],
          },
          add: { imports: [DiscussionsStub, PreviewsStub] },
        });
      if (component === ApplicationReviewsApiPageComponent)
        TestBed.overrideComponent(component, {
          remove: { imports: [MemberReviewsComponent] },
          add: { imports: [ReviewsStub] },
        });
      const harness = await RouterTestingHarness.create();
      const page = await harness.navigateByUrl(
        `/apps/example/${name}`,
        component
      );
      async function settle() {
        harness.detectChanges();
        await harness.fixture.whenStable();
        harness.detectChanges();
      }
      await settle();
      expect(harness.routeNativeElement?.textContent).toContain(
        application.name
      );
      expect(child.open.mock.lastCall?.[0]).toBe(
        kind === 'id' ? application.id : application.slug
      );
      choice.set({
        ...choice(),
        sessionKey: 'Bob',
        sessionVersion: 2,
        status: 'loading',
      });
      expect(page.app.application()).toBeNull();
      await settle();
      expect(harness.routeNativeElement?.textContent).not.toContain(
        application.name
      );
      expect(harness.routeNativeElement?.textContent).not.toContain('Child ');
      if (name === 'devlog') expect(child.close).toHaveBeenCalled();
      else
        expect(child.open.mock.lastCall?.[0]).toBe(kind === 'id' ? null : '');
      choice.set({ ...choice(), status: 'unavailable' });
      await settle();
      expect(harness.routeNativeElement?.textContent).toContain(
        'Content preferences unavailable'
      );
      page.app.reload();
      expect(reload).toHaveBeenCalledTimes(1);
      choice.set({ ...choice(), status: 'ready', showMatureContent: false });
      await settle();
      expect(harness.routeNativeElement?.textContent).toContain(
        'Application hidden'
      );
      expect(harness.routeNativeElement?.textContent).not.toContain(
        application.name
      );
      expect(
        harness.routeNativeElement?.querySelector(
          'application-discussions, member-reviews, .health-monitor, .timeline-card, .application-draft-card'
        )
      ).toBeNull();
      choice.set({ ...choice(), showMatureContent: true });
      await settle();
      expect(harness.routeNativeElement?.textContent).toContain(
        application.name
      );
      expect(child.open.mock.lastCall?.[0]).toBe(
        kind === 'id' ? application.id : application.slug
      );
    });
  }
);
