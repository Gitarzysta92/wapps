import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { PasswordResetPageComponent } from './password-reset-page.component';

describe('password email action route', () => {
  it.each([
    [{ mode: 'resetPassword', oobCode: 'code' }, 'code'],
    [{ mode: 'verifyEmail', oobCode: 'code' }, 'code'],
    [{ mode: 'recoverEmail', oobCode: 'code' }, null],
    [{ mode: 'resetPassword' }, null],
    [{ mode: ['resetPassword', 'verifyEmail'], oobCode: 'code' }, null],
    [{ mode: 'resetPassword', oobCode: ['one', 'two'] }, null],
  ])(
    'accepts only a single supported action and removes its secrets from history: %j',
    (params, expected) => {
      const replaceState = jest.fn();
      TestBed.configureTestingModule({
        imports: [PasswordResetPageComponent],
        providers: [
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { queryParamMap: convertToParamMap(params) },
            },
          },
          { provide: Location, useValue: { replaceState } },
        ],
      });
      TestBed.overrideComponent(PasswordResetPageComponent, {
        set: { template: '', imports: [] },
      });
      const fixture = TestBed.createComponent(PasswordResetPageComponent);
      expect(fixture.componentInstance.code).toBe(expected);
      expect(replaceState).toHaveBeenCalledWith('/auth/action');
    }
  );
});
