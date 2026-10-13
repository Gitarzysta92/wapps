import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import { AuthenticationService } from './authentication.service';
import { AUTHENTICATION_SESSION } from './authentication-session.port';
import { AUTHENTICATION_HANDLER } from './authentication-handler.token';

describe('sign-out session isolation', () => {
  it.each(['success', 'error'] as const)(
    'clears private session state immediately without clearing a later login: %s',
    (outcome) => {
      const token = new BehaviorSubject<string | null>('alice');
      const pending = new Subject<Result<void, Error>>();
      const clear = jest.fn(() => token.next(null));
      TestBed.configureTestingModule({
        providers: [
          AuthenticationService,
          {
            provide: AUTHENTICATION_SESSION,
            useValue: { token$: token, getToken: () => token.value, clear },
          },
          {
            provide: AUTHENTICATION_HANDLER,
            useValue: { signOut: () => pending },
          },
        ],
      });
      TestBed.inject(AuthenticationService).unauthenticate();
      expect(token.value).toBeNull();
      token.next('bob');
      if (outcome === 'success') pending.next({ ok: true, value: undefined });
      else pending.error(new Error('delayed failure'));
      expect(token.value).toBe('bob');
      expect(clear).toHaveBeenCalledTimes(1);
    }
  );
});
