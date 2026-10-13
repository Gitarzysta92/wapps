import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, EMPTY, Subject, of, throwError } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  ACCOUNT_ERASURE,
  type AccountErasureAcceptance,
  type ErasureAccount,
} from './account-erasure.port';
import { AUTHENTICATION_SESSION } from './authentication-session.port';
import { AccountErasureService } from './account-erasure.service';
import { AUTHENTICATION_RECOVERY_CONTROL } from './authentication-recovery-control';

describe('account erasure consent and session isolation', () => {
  const token = new BehaviorSubject<string | null>('alice');
  const port = { prepare: jest.fn(), request: jest.fn() };
  const clear = jest.fn(() => token.next(null));
  const receipt: AccountErasureAcceptance = {
    identityId: 'Alice',
    revision: 3,
    status: 'accepted',
    cleanup: 'pending',
  };
  let service: AccountErasureService;
  beforeEach(() => {
    jest.resetAllMocks();
    token.next('alice');
    clear.mockImplementation(() => token.next(null));
    port.prepare.mockReturnValue(
      of(ok({ identityId: 'Alice', name: 'Alice' }))
    );
    port.request.mockReturnValue(of(ok(receipt)));
    TestBed.configureTestingModule({
      providers: [
        AccountErasureService,
        { provide: ACCOUNT_ERASURE, useValue: port },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value, clear },
        },
      ],
    });
    service = TestBed.inject(AccountErasureService);
  });
  afterEach(() => TestBed.resetTestingModule());
  it('requires a current account, explicit consent and the exact confirmation', () => {
    service.confirm('DELETE', true);
    expect(port.request).not.toHaveBeenCalled();
    service.begin();
    service.confirm('DELETE', false);
    service.confirm('delete', true);
    expect(port.request).not.toHaveBeenCalled();
    service.confirm('DELETE', true);
    expect(port.request).toHaveBeenCalledWith('Alice');
    expect(service.state()).toBe('accepted');
    expect(service.feedback()).toContain('cleanup is pending');
    expect(service.signedIn()).toBe(false);
    expect(service.account()).toBeNull();
    expect(clear).toHaveBeenCalledTimes(1);
  });
  it('cancels consent without sending a destructive request', () => {
    service.begin();
    service.cancel();
    service.confirm('DELETE', true);
    expect(port.request).not.toHaveBeenCalled();
    expect(service.state()).toBe('idle');
    expect(clear).not.toHaveBeenCalled();
  });
  it('does not cancel or duplicate an already submitted deletion', () => {
    const pending = new Subject<Result<AccountErasureAcceptance, Error>>();
    port.request.mockReturnValue(pending);
    service.begin();
    service.confirm('DELETE', true);
    service.cancel();
    service.confirm('DELETE', true);
    service.begin();
    expect(TestBed.inject(AUTHENTICATION_RECOVERY_CONTROL).hold === null).toBe(
      false
    );
    expect(port.request).toHaveBeenCalledTimes(1);
    expect(service.state()).toBe('submitting');
    expect(pending.observed).toBe(true);
    pending.next(ok(receipt));
    expect(service.state()).toBe('accepted');
    expect(TestBed.inject(AUTHENTICATION_RECOVERY_CONTROL).hold === null).toBe(
      true
    );
  });
  it.each(['result', 'throw', 'empty'])(
    'treats %s failure after sending as uncertain without retry',
    (mode) => {
      port.request.mockImplementation(() =>
        mode === 'throw'
          ? throwError(() => new Error('lost'))
          : mode === 'empty'
          ? EMPTY
          : of(err(new Error('lost')))
      );
      service.begin();
      service.confirm('DELETE', true);
      expect(service.state()).toBe('uncertain');
      expect(service.feedback()).toContain(
        'may already have closed your account'
      );
      service.begin();
      service.confirm('DELETE', true);
      expect(port.request).toHaveBeenCalledTimes(1);
      expect(clear).toHaveBeenCalledTimes(1);
    }
  );
  it.each(['completed', 'failed'] as const)(
    'reports accepted cleanup state %s accurately',
    (cleanup) => {
      port.request.mockReturnValue(of(ok({ ...receipt, cleanup })));
      service.begin();
      service.confirm('DELETE', true);
      expect(service.feedback()).toContain(
        cleanup === 'completed'
          ? 'cleanup is complete'
          : 'cleanup needs operator attention'
      );
      expect(service.state()).toBe('accepted');
    }
  );
  it('does not expose an old acceptance or clear a newer sign-in', () => {
    const pending = new Subject<Result<AccountErasureAcceptance, Error>>();
    port.request.mockReturnValue(pending);
    service.begin();
    service.confirm('DELETE', true);
    token.next('bob');
    pending.next(ok(receipt));
    expect(pending.observed).toBe(false);
    expect(service.state()).toBe('idle');
    expect(service.feedback()).toBe('');
    expect(clear).not.toHaveBeenCalled();
    expect(token.value).toBe('bob');
  });
  it('discards a prepared confirmation on sign-out or token change', () => {
    service.begin();
    token.next(null);
    token.next('bob');
    service.confirm('DELETE', true);
    expect(port.request).not.toHaveBeenCalled();
    const pending = new Subject<Result<ErasureAccount, Error>>();
    port.prepare.mockReturnValue(pending);
    service.begin();
    token.next('carol');
    pending.next(ok({ identityId: 'Bob', name: 'Private name' }));
    expect(service.account()).toBeNull();
    expect(service.state()).toBe('idle');
  });
  it('keeps preparation failures separate from sent requests and permits a fresh read', () => {
    port.prepare.mockReturnValueOnce(EMPTY);
    service.begin();
    expect(service.state()).toBe('error');
    expect(service.feedback()).toContain('No deletion request was sent');
    expect(clear).not.toHaveBeenCalled();
    service.begin();
    expect(service.state()).toBe('confirming');
  });
  it('clears the terminal message when another session begins', () => {
    service.begin();
    service.confirm('DELETE', true);
    expect(service.terminal()).toBe(true);
    token.next('bob');
    expect(service.terminal()).toBe(false);
    expect(service.feedback()).toBe('');
  });
  it('keeps acceptance distinct from a failed local sign-out', () => {
    clear.mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    service.begin();
    service.confirm('DELETE', true);
    expect(service.state()).toBe('accepted');
    expect(service.feedback()).toContain(
      'Browser sign-out could not be completed'
    );
    expect(service.feedback()).not.toContain('This browser is signed out.');
  });
});
