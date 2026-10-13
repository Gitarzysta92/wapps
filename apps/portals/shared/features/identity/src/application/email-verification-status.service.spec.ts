import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, Result } from '@sdk/kernel/standard';
import {
  CredentialEmailRequest,
  CredentialEmailStatus,
} from '@sdk/features/identity/libs/authentication';
import { AUTHENTICATION_SESSION } from './authentication-session.port';
import { EMAIL_VERIFICATION } from './email-verification.port';
import { EmailVerificationStatusService } from './email-verification-status.service';

describe('private email verification state', () => {
  const token = new BehaviorSubject<string | null>('alice');
  const provider = { mode: 'api', status: jest.fn(), request: jest.fn() };
  beforeEach(() => {
    token.next('alice');
    jest.resetAllMocks();
    provider.mode = 'api';
    provider.status.mockReturnValue(
      of(ok({ email: 'alice@example.test', verified: false }))
    );
    provider.request.mockReturnValue(of(ok('requested')));
    TestBed.configureTestingModule({
      providers: [
        EmailVerificationStatusService,
        { provide: AUTHENTICATION_SESSION, useValue: { token$: token } },
        { provide: EMAIL_VERIFICATION, useValue: provider },
      ],
    });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('requests and refreshes live status without claiming delivery', () => {
    const service = TestBed.inject(EmailVerificationStatusService);
    service.request();
    expect(service.feedback()).toContain('email requested');
    expect(service.status()?.verified).toBe(false);
    provider.status.mockReturnValue(
      of(ok({ email: 'alice@example.test', verified: true }))
    );
    service.refresh();
    expect(service.status()?.verified).toBe(true);
    service.request();
    expect(provider.request).toHaveBeenCalledTimes(1);
  });
  it('cancels old reads and removes private email on sign-out', () => {
    const pending = new Subject<Result<CredentialEmailStatus, Error>>();
    provider.status.mockReturnValue(pending);
    const service = TestBed.inject(EmailVerificationStatusService);
    token.next(null);
    pending.next(ok({ email: 'alice@example.test', verified: true }));
    expect(service.status()).toBeNull();
    expect(service.signedIn()).toBe(false);
    expect(service.busy()).toBe(false);
  });
  it('cannot attribute a delayed delivery response to a different account', () => {
    const pending = new Subject<Result<CredentialEmailRequest, Error>>();
    provider.request.mockReturnValue(pending);
    const service = TestBed.inject(EmailVerificationStatusService);
    service.request();
    provider.status.mockReturnValue(
      of(ok({ email: 'bob@example.test', verified: false }))
    );
    token.next('bob');
    pending.next(ok('requested'));
    expect(service.status()?.email).toBe('bob@example.test');
    expect(service.feedback()).toBe('');
  });
  it('keeps failed and unknown status distinct from unverified', () => {
    provider.status.mockReturnValue(of(err(new Error('Unavailable'))));
    const service = TestBed.inject(EmailVerificationStatusService);
    expect(service.status()).toBeNull();
    expect(service.error()).toBe(true);
    service.request();
    expect(provider.request).not.toHaveBeenCalled();
  });
  it('does not automatically resend an uncertain request', () => {
    provider.request.mockReturnValue(of(err(new Error('Unknown outcome'))));
    const service = TestBed.inject(EmailVerificationStatusService);
    service.request();
    expect(service.error()).toBe(true);
    expect(provider.request).toHaveBeenCalledTimes(1);
  });
  it('never performs provider verification in explicit demo mode', () => {
    provider.mode = 'demo';
    const service = TestBed.inject(EmailVerificationStatusService);
    service.refresh();
    service.request();
    expect(provider.status).not.toHaveBeenCalled();
    expect(provider.request).not.toHaveBeenCalled();
  });
});
