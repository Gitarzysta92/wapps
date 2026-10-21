import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { ApplicationHealthReport } from '@domains/reliability';
import { APPLICATION_HEALTH } from '@apps/portals/shared/features/health-status';
import { APPLICATION_OVERVIEW_PROVIDER, type OverviewDto } from '@portals/shared/features/application-overview';
import { PublicContentPreferencesService, type PublicContentChoice } from '@portals/shared/features/preferences';
import { ApplicationHealthApiPageComponent } from './application-health-api-page.component';

const application: OverviewDto = {
  id: '10000000-0000-4000-8000-000000000001', revision: 1,
  slug: 'current', name: 'Current application', classification: 'general',
  description: null, website: null, logo: null, banner: null, isPwa: false,
  listingDate: null, updateDate: null, platforms: [], monetizations: [],
  categories: [], tags: [], estimatedUsers: null, reviews: null, includedSuites: null,
};
const report: ApplicationHealthReport = { application, asOf: Date.UTC(2026, 9, 19), monitors: [] };

describe('accepted API health page', () => {
  let fixture: ComponentFixture<ApplicationHealthApiPageComponent>;
  let overview: jest.Mock, read: jest.Mock;
  const choice = signal<PublicContentChoice>({ status: 'ready', sessionKey: 'Alice', sessionVersion: 1, showMatureContent: true });
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    choice.set({ status: 'ready', sessionKey: 'Alice', sessionVersion: 1, showMatureContent: true });
    params = new BehaviorSubject(convertToParamMap({ appSlug: 'current' }));
    overview = jest.fn(() => of(ok(application)));
    read = jest.fn(() => of(ok(report)));
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideNoopAnimations(),
      { provide: ActivatedRoute, useValue: { paramMap: params, snapshot: { paramMap: params.value } } },
      { provide: APPLICATION_OVERVIEW_PROVIDER, useValue: { getOverview: overview } },
      { provide: APPLICATION_HEALTH, useValue: { read } },
      { provide: PublicContentPreferencesService, useValue: { state: choice, reload: jest.fn() } },
    ] });
    fixture = TestBed.createComponent(ApplicationHealthApiPageComponent);
  });
  afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); });
  async function settle() {
    for (let count = 0; count < 3; count++) {
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
  }
  const body = () => fixture.nativeElement.textContent as string;

  it('retains the original sections and badge without inventing unconfigured services or notices', async () => {
    await settle();
    expect(read).toHaveBeenCalledWith('current');
    expect(fixture.nativeElement.querySelector('health-check-badge').textContent).toContain('Unknown');
    expect(body()).toContain('30-Day Status History');
    expect(body()).toContain('Service Status');
    expect(body()).toContain('Recent Notices');
    expect(body()).toContain('Notices unavailable');
    expect(body()).toContain('Health unknown');
    expect(body()).not.toMatch(/No recent notices|99\.9|All Systems Operational|Database/);
    expect(fixture.nativeElement.querySelector('.health-monitor')).toBeNull();
  });

  it('clears completed evidence during refresh, exposes failure and recovers through the retry action', async () => {
    await settle();
    const pending = new Subject<Result<ApplicationHealthReport, Error>>();
    read.mockReturnValueOnce(pending);
    fixture.componentInstance.refresh();
    await settle();
    expect(body()).toContain('Loading HTTP observations');
    expect(fixture.nativeElement.querySelector('health-check-badge')).toBeNull();
    pending.next(err(new Error('Dependency offline')));
    await settle();
    expect(body()).toContain('Observations unavailable');
    expect(body()).not.toContain('Recent Notices');
    const retry = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.includes('Retry checks'));
    if (!retry) throw new Error('Missing retry action');
    retry.click();
    await settle();
    expect(body()).toContain('Health unknown');
    expect(body()).not.toContain('Observations unavailable');
  });

  it('cancels health reads on navigation and never shows the previous application during new catalog reads', async () => {
    const pending = new Subject<Result<ApplicationHealthReport, Error>>();
    read.mockReturnValueOnce(pending);
    await settle();
    overview.mockReturnValueOnce(new Subject());
    params.next(convertToParamMap({ appSlug: 'next' }));
    expect(fixture.componentInstance.view()).toBeNull();
    await settle();
    expect(pending.observed).toBe(false);
    pending.next(ok(report));
    expect(fixture.componentInstance.health.report()).toBeNull();
    expect(body()).not.toContain('Health unknown');
  });

  it('removes health on account changes and does not reload a parent hidden by the new preferences', async () => {
    overview.mockReturnValue(of(ok({ ...application, classification: 'mature' })));
    await settle();
    expect(body()).toContain('Health unknown');
    choice.set({ status: 'loading', sessionKey: 'Bob', sessionVersion: 2, showMatureContent: false });
    expect(fixture.componentInstance.view()).toBeNull();
    await settle();
    expect(body()).toContain('Loading content preferences');
    expect(fixture.componentInstance.health.report()).toBeNull();
    choice.set({ ...choice(), status: 'ready' });
    await settle();
    expect(body()).toContain('This application is hidden by your content preferences');
    expect(read).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('health-check-badge')).toBeNull();
  });
});
