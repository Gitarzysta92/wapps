import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { randomUUID } from 'node:crypto';
import { of } from 'rxjs';
import { APPLICATIONS } from '@portals/shared/data';
import { APPLICATION_OVERVIEW_PROVIDER, LocalDiscussionsService, OverviewDto } from '@portals/shared/features/application-overview';
import { CATALOG_ENTRIES } from '@portals/shared/features/listing';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { PreferencesService } from '@portals/shared/features/preferences';
import { ApplicationOverviewPageComponent } from './application-overview-page.component';
import { EntryDetailsDataService } from '../entry-details-page/entry-details-data.service';

describe('application overview details', () => {
  const dateFormat = signal('yyyy-MM-dd');
  const photoSnap = APPLICATIONS.find(app => app.slug === 'photo-snap')!;
  const originalRandomUUID = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  beforeAll(() => Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID }));
  afterAll(() => {
    if (originalRandomUUID) Object.defineProperty(crypto, 'randomUUID', originalRandomUUID);
    else Reflect.deleteProperty(crypto, 'randomUUID');
  });
  beforeEach(() => localStorage.removeItem('wapps.local-discussions.v1'));
  afterEach(() => localStorage.removeItem('wapps.local-discussions.v1'));

  async function page(records: OverviewDto[]) {
    dateFormat.set('yyyy-MM-dd');
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: APPLICATION_OVERVIEW_PROVIDER, useValue: {
        getOverview: (slug: string) => of({ ok: true, value: records.find(app => app.slug === slug) })
      } },
      { provide: MyFavoritesService, useValue: { isFavorite$: () => of(false) } },
      { provide: PreferencesService, useValue: { dateFormat } },
    ] });
    const fixture = TestBed.createComponent(ApplicationOverviewPageComponent);
    fixture.componentRef.setInput('appSlug', records[0].slug);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows catalog details and updates dates when the display preference changes', async () => {
    const fixture = await page([{ ...photoSnap,
      listingDate: new Date(2026, 7, 12), updateDate: new Date(2026, 8, 12)
    }]);
    const details = fixture.nativeElement.querySelector('[aria-labelledby="application-details-title"]');
    expect(details.textContent).toContain('Web, Mobile');
    expect(details.textContent).toContain('Freemium, Premium Subscription');
    expect(details.textContent).toContain('1,000,000');
    expect(details.textContent).toContain('2026-08-12');
    expect(details.textContent).toContain('2026-09-12');
    dateFormat.set('dd/MM/yyyy');
    fixture.detectChanges();
    expect(details.textContent).toContain('12/08/2026');
    expect(details.textContent).toContain('12/09/2026');
  });

  it('replaces details on navigation and handles incomplete records without stale or invented values', async () => {
    const incomplete = { ...photoSnap, slug: 'incomplete', platformIds: [999], monetizations: [],
      number: NaN, listingDate: undefined, updateDate: new Date(NaN) };
    const fixture = await page([photoSnap, incomplete]);
    fixture.componentRef.setInput('appSlug', incomplete.slug);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const values = Array.from(fixture.nativeElement.querySelectorAll('.detail-list dd'),
      (element: Element) => element.textContent?.trim());
    expect(values).toEqual(['Not specified', 'Not specified', 'Not provided', 'Not provided', 'Not provided']);
    expect(fixture.nativeElement.querySelector('[aria-labelledby="overview-suites-title"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-labelledby="overview-discussions-title"]').textContent).toContain('No discussions yet');
  });

  it('keeps recent discussions and their links scoped to the current app, including saved conversations', async () => {
    const quickTask = APPLICATIONS.find(app => app.slug === 'quick-task')!;
    const fixture = await page([photoSnap, quickTask]);
    const discussions = TestBed.inject(LocalDiscussionsService);
    const photoThread = discussions.create(photoSnap.slug, 'Photo editing workflow', 'A saved conversation');
    const taskThread = discussions.create(quickTask.slug, 'Task workflow', 'Only for Quick Task');
    discussions.reply(photoSnap.slug, photoThread.slug, 'A local reply');
    fixture.detectChanges();
    const section = () => fixture.nativeElement.querySelector('[aria-labelledby="overview-discussions-title"]');
    expect(section().querySelectorAll('discussion-small-card')).toHaveLength(2);
    expect(section().querySelector('a.preview-link').getAttribute('href')).toBe(`/apps/photo-snap/discussions/${photoThread.slug}`);
    expect(fixture.componentInstance.recentDiscussions()[0].repliesCount).toBe(1);
    expect(section().textContent).not.toContain('Task workflow');
    fixture.componentRef.setInput('appSlug', quickTask.slug);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(section().textContent).not.toContain('Photo editing workflow');
    expect(section().querySelector('a.preview-link').getAttribute('href')).toBe(`/apps/quick-task/discussions/${taskThread.slug}`);
  });

  it('links only suites containing this app and counts each member once', async () => {
    const fixture = await page([photoSnap]);
    const section = fixture.nativeElement.querySelector('[aria-labelledby="overview-suites-title"]');
    const matching = CATALOG_ENTRIES.filter(entry => entry.kind === 'suites' && entry.applications?.some(app => app.slug === photoSnap.slug));
    expect(section.querySelectorAll('.suite-card')).toHaveLength(matching.length);
    for (const suite of matching) {
      expect(section.querySelector(`a[href="/suites/${suite.slug}"]`)).not.toBeNull();
      const detail = TestBed.inject(EntryDetailsDataService).suite(suite.slug)!;
      expect(detail.apps).toHaveLength(new Set(detail.apps.map(app => app.slug)).size);
      expect(section.querySelector(`a[href="/suites/${suite.slug}"] .suite-meta`).textContent).toContain(`${detail.apps.length} applications`);
    }
    const productivity = fixture.componentInstance.includedSuites().find(suite => suite.slug === 'complete-productivity-suite')!;
    expect(productivity.members.filter(app => app.slug === photoSnap.slug)).toHaveLength(1);
    expect(section.querySelector('a[href="/suites/complete-productivity-suite"] .suite-meta').textContent).toContain('7 applications');
  });
});
