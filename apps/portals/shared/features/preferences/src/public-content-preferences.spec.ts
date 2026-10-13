import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import { err, ok, type Result } from '@sdk/kernel/standard';
import { PreferencesService } from './application/preferences.service';
import { PublicContentPreferencesService } from './application/public-content-preferences.service';
import {
  GUEST_PREFERENCES_PORT,
  PREFERENCES_MODE,
  PREFERENCES_PORT,
  PREFERENCES_SESSION,
  type PreferencesRead,
} from './application/preferences-session.port';

describe('public content preferences', () => {
  let session: BehaviorSubject<string | null>;
  let reads: Subject<Result<PreferencesRead, Error>>[];
  let service: PublicContentPreferencesService;
  const saved = (showMatureContent: boolean): PreferencesRead => {
    const data = defaultAccountPreferences();
    data.content.showMatureContent = showMatureContent;
    return { data, account: null };
  };
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('Alice');
    reads = [];
    TestBed.configureTestingModule({
      providers: [
        PreferencesService,
        { provide: PREFERENCES_MODE, useValue: 'api' },
        {
          provide: PREFERENCES_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
        {
          provide: PREFERENCES_PORT,
          useValue: {
            read: () => {
              const request = new Subject<Result<PreferencesRead, Error>>();
              reads.push(request);
              return request;
            },
          },
        },
        {
          provide: GUEST_PREFERENCES_PORT,
          useValue: { read: () => of(ok(saved(false))) },
        },
      ],
    });
    service = TestBed.inject(PublicContentPreferencesService);
  });
  it('reveals a choice only after the current account read completes', () => {
    expect(service.state().status).toBe('loading');
    reads[0].next(ok(saved(true)));
    expect(service.state()).toMatchObject({
      status: 'ready',
      sessionKey: 'Alice',
      showMatureContent: true,
    });
    session.next('Bob');
    expect(service.state()).toMatchObject({
      status: 'loading',
      showMatureContent: false,
    });
    reads[0].next(ok(saved(true)));
    expect(service.state().status).toBe('loading');
    reads[1].next(ok(saved(false)));
    expect(service.state()).toMatchObject({
      status: 'ready',
      sessionKey: 'Bob',
      showMatureContent: false,
    });
  });
  it('clears the previous choice on reload and failure and recovers on retry', () => {
    reads[0].next(ok(saved(true)));
    service.reload();
    expect(service.state()).toMatchObject({
      status: 'loading',
      showMatureContent: false,
    });
    reads[1].next(err(new Error('Offline')));
    expect(service.state()).toMatchObject({
      status: 'unavailable',
      showMatureContent: false,
    });
    service.reload();
    reads[2].next(ok(saved(false)));
    expect(service.state()).toMatchObject({
      status: 'ready',
      showMatureContent: false,
    });
  });
  it('uses the guest disabled default after sign-out without inheriting the account choice', () => {
    reads[0].next(ok(saved(true)));
    session.next(null);
    expect(service.state()).toMatchObject({
      status: 'ready',
      sessionKey: null,
      showMatureContent: false,
    });
  });
});
