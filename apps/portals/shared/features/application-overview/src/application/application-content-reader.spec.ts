import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  PublicContentPreferencesService,
  type PublicContentChoice,
} from '@portals/shared/features/preferences';
import { APPLICATION_OVERVIEW_PROVIDER } from './overview-providers.port';
import { LOCAL_APPLICATION_DATA } from './application-data-mode.token';
import type { OverviewDto } from './overview.dto';
import { readApplicationContent } from './application-content-reader';
import { ApplicationContentStateComponent } from '../presentation/application-content-state.component';

const application: OverviewDto = {
  id: '10000000-0000-4000-8000-000000000001',
  revision: 1,
  slug: 'current',
  name: 'Current application',
  classification: 'general',
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

@Component({
  imports: [ApplicationContentStateComponent],
  template:
    '<application-content-state [reader]="reader" /> @if (reader.application(); as app) { <h1>{{ app.name }}</h1> }',
})
class HostComponent {
  readonly slug = signal('current');
  readonly reader = readApplicationContent(this.slug);
}

describe('application content reader', () => {
  const choice = signal<PublicContentChoice>({
    status: 'ready',
    sessionKey: 'Alice',
    sessionVersion: 1,
    showMatureContent: false,
  });
  let overview: jest.Mock, retry: jest.Mock;
  let fixture: ComponentFixture<HostComponent>;
  beforeEach(() => {
    choice.set({
      status: 'ready',
      sessionKey: 'Alice',
      sessionVersion: 1,
      showMatureContent: false,
    });
    overview = jest.fn(() => of(ok(application)));
    retry = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        {
          provide: APPLICATION_OVERVIEW_PROVIDER,
          useValue: { getOverview: overview },
        },
        {
          provide: PublicContentPreferencesService,
          useValue: { state: choice, reload: retry },
        },
      ],
    });
  });
  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function create() {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it.each(['mature', undefined] as const)(
    'hides %s parent metadata and permits only an explicit enabled choice',
    async (classification) => {
      overview.mockReturnValue(of(ok({ ...application, classification })));
      const host = create();
      await settle();
      expect(host.reader.status()).toBe('hidden');
      expect(fixture.nativeElement.textContent).not.toContain(application.name);
      expect(fixture.nativeElement.textContent).toContain('Application hidden');
      choice.set({ ...choice(), showMatureContent: true });
      await settle();
      expect(host.reader.application()?.name).toBe(application.name);
      choice.set({
        ...choice(),
        sessionKey: null,
        sessionVersion: 2,
        showMatureContent: false,
      });
      expect(host.reader.application()).toBeNull();
      await settle();
      expect(host.reader.status()).toBe('hidden');
    }
  );

  it('does not read before preferences are ready and retries a failed preference read', async () => {
    choice.set({ ...choice(), status: 'loading' });
    const host = create();
    await settle();
    expect(overview).not.toHaveBeenCalled();
    expect(host.reader.status()).toBe('preferences-loading');
    choice.set({ ...choice(), status: 'unavailable' });
    await settle();
    expect(host.reader.status()).toBe('preferences-unavailable');
    fixture.nativeElement.querySelector('button').click();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(overview).not.toHaveBeenCalled();
    choice.set({ ...choice(), status: 'ready' });
    await settle();
    expect(host.reader.application()?.id).toBe(application.id);
  });

  it('masks the previous route synchronously and ignores a cancelled response', async () => {
    const host = create();
    await settle();
    const late = new Subject<Result<OverviewDto, Error>>();
    overview.mockReturnValueOnce(late);
    host.slug.set('older');
    expect(host.reader.application()).toBeNull();
    fixture.detectChanges();
    TestBed.flushEffects();
    overview.mockReturnValue(
      of(ok({ ...application, slug: 'newer', name: 'Newer application' }))
    );
    host.slug.set('newer');
    await settle();
    expect(late.observed).toBe(false);
    late.next(ok({ ...application, name: 'Obsolete application' }));
    expect(host.reader.application()?.name).toBe('Newer application');
  });

  it('clears completed content immediately on account changes and cancels in-flight reads', async () => {
    const host = create();
    await settle();
    choice.set({
      ...choice(),
      sessionKey: 'Bob',
      status: 'loading',
      sessionVersion: 2,
    });
    expect(host.reader.application()).toBeNull();
    await settle();
    const late = new Subject<Result<OverviewDto, Error>>();
    overview.mockReturnValue(late);
    choice.set({ ...choice(), status: 'ready' });
    fixture.detectChanges();
    TestBed.flushEffects();
    choice.set({ ...choice(), status: 'unavailable' });
    await settle();
    expect(late.observed).toBe(false);
    late.next(ok(application));
    expect(host.reader.application()).toBeNull();
    expect(host.reader.status()).toBe('preferences-unavailable');
  });

  it.each([404, 503])(
    'distinguishes missing and failed reads (%s) and recovers on retry',
    async (status) => {
      overview.mockReturnValue(
        of(err(Object.assign(new Error('Read failed'), { status })))
      );
      const host = create();
      await settle();
      expect(host.reader.status()).toBe(
        status === 404 ? 'missing' : 'unavailable'
      );
      overview.mockReturnValue(of(ok(application)));
      host.reader.reload();
      await settle();
      expect(host.reader.application()?.id).toBe(application.id);
    }
  );

  it('keeps demo mode explicit and independent of API preferences', async () => {
    TestBed.overrideProvider(LOCAL_APPLICATION_DATA, { useValue: true });
    choice.set({ ...choice(), status: 'unavailable' });
    overview.mockReturnValue(
      of(ok({ ...application, classification: undefined }))
    );
    const host = create();
    await settle();
    expect(host.reader.status()).toBe('ready');
  });
});
