import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { err, ok, Result } from '@sdk/kernel/standard';
import { VALIDATION_MESSAGES as REGISTRATION_MESSAGES } from '@ui/registration';
import { VALIDATION_MESSAGES as RECOVERY_MESSAGES } from '@ui/password-reset';
import { RegistrationContainerComponent } from './registration/registration-container.component';
import { PasswordResetRequestContainerComponent } from './password-reset/password-reset-request-container.component';
import { PasswordResetContainerComponent } from './password-reset/password-reset-container.component';
import { REGISTRATION_HANDLER } from '../../application/registration-handler.token';
import { PASSWORD_RESET_HANDLER } from '../../application/password-reset-handler.token';
import { PASSWORD_RESET_REQUEST_HANDLER } from '../../application/password-reset-request-handler.token';

@Component({
  selector: 'identity-test-shell',
  imports: [
    RegistrationContainerComponent,
    PasswordResetRequestContainerComponent,
    PasswordResetContainerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <registration-container />
    <password-reset-request-container />
    <password-reset-container code="async-code" />
  `,
})
class IdentityTestShellComponent {}

@Component({
  imports: [IdentityTestShellComponent],
  template: '<identity-test-shell />',
})
class IdentityTestRootComponent {}

describe('identity forms', () => {
  const register = jest.fn();
  const requestPasswordReset = jest.fn();
  const verifyCode = jest.fn();
  const resetPassword = jest.fn();
  const input = {
    email: 'alice@example.test',
    nickname: 'Alice',
    password: 'password',
    passwordConfirmation: 'password',
  };
  beforeEach(() => {
    jest.resetAllMocks();
    TestBed.configureTestingModule({
      imports: [
        RegistrationContainerComponent,
        PasswordResetRequestContainerComponent,
        PasswordResetContainerComponent,
        IdentityTestRootComponent,
      ],
      providers: [
        provideNoopAnimations(),
        {
          provide: REGISTRATION_MESSAGES,
          useValue: {
            nickname: [],
            email: [],
            password: [],
            passwordConfirmation: [],
          },
        },
        { provide: RECOVERY_MESSAGES, useValue: { email: [] } },
        { provide: REGISTRATION_HANDLER, useValue: { register } },
        {
          provide: PASSWORD_RESET_REQUEST_HANDLER,
          useValue: { requestPasswordReset },
        },
        {
          provide: PASSWORD_RESET_HANDLER,
          useValue: { verifyCode, resetPassword },
        },
      ],
    });
  });
  it('renders asynchronous completion and failures through an OnPush shell', async () => {
    const verification = new Subject<Result<void, Error>>();
    const completion = new Subject<Result<boolean, Error>>();
    const enrollment = new Subject<Result<boolean, Error>>();
    const recovery = new Subject<Result<void, Error>>();
    verifyCode.mockReturnValue(verification);
    resetPassword.mockReturnValue(completion);
    register.mockReturnValue(enrollment);
    requestPasswordReset.mockReturnValue(recovery);
    const fixture = TestBed.createComponent(IdentityTestRootComponent);
    fixture.autoDetectChanges();
    const reset: PasswordResetContainerComponent = fixture.debugElement.query(
      By.directive(PasswordResetContainerComponent)
    ).componentInstance;
    const registration: RegistrationContainerComponent =
      fixture.debugElement.query(
        By.directive(RegistrationContainerComponent)
      ).componentInstance;
    const request: PasswordResetRequestContainerComponent =
      fixture.debugElement.query(
        By.directive(PasswordResetRequestContainerComponent)
      ).componentInstance;
    expect(fixture.nativeElement.textContent).toContain(
      'Checking your reset link'
    );
    await Promise.resolve().then(() => {
      verification.next(ok(undefined));
      verification.complete();
    });
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('#reset-password')
    ).not.toBeNull();

    reset.form.setValue({
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });
    reset.submit();
    registration.register(input);
    request.onFormSubmit({ email: input.email });
    await Promise.resolve().then(() => {
      completion.next(ok(true));
      completion.complete();
      enrollment.error(new Error('unavailable'));
      recovery.next(ok(undefined));
      recovery.complete();
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'Your password has been changed'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Registration could not be confirmed'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'If this email has an account'
    );
    expect(registration.isRegistering).toBe(false);
    expect(request.isProcessing).toBe(false);
    expect(reset.saving).toBe(false);
    expect(fixture.nativeElement.querySelector('#reset-password')).toBeNull();
  });
  it('blocks duplicate submission, clears busy on errors and renders a truthful registration transition', () => {
    const pending = new Subject<Result<boolean, Error>>();
    register.mockReturnValue(pending);
    const fixture = TestBed.createComponent(RegistrationContainerComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.register(input);
    component.register(input);
    expect(register).toHaveBeenCalledTimes(1);
    expect(component.isRegistering).toBe(true);
    pending.error(new Error('network'));
    fixture.detectChanges();
    expect(component.isRegistering).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'could not be confirmed'
    );
    register.mockReturnValue(of(ok(true)));
    component.register(input);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sign in to continue');
    expect(fixture.nativeElement.querySelector('registration-form')).toBeNull();
  });
  it('renders Result errors and restores recovery controls after observable errors', () => {
    requestPasswordReset.mockReturnValue(
      of(err(new Error('Delivery unavailable')))
    );
    const fixture = TestBed.createComponent(
      PasswordResetRequestContainerComponent
    );
    fixture.detectChanges();
    fixture.componentInstance.onFormSubmit({ email: input.email });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Delivery unavailable');
    expect(fixture.componentInstance.sent).toBe(false);
    requestPasswordReset.mockReturnValue(
      throwError(() => new Error('network'))
    );
    fixture.componentInstance.onFormSubmit({ email: input.email });
    expect(fixture.componentInstance.isProcessing).toBe(false);
  });
  it('acknowledges recovery without disclosing account existence', () => {
    requestPasswordReset.mockReturnValue(of(ok(undefined)));
    const fixture = TestBed.createComponent(
      PasswordResetRequestContainerComponent
    );
    fixture.detectChanges();
    fixture.componentInstance.onFormSubmit({ email: input.email });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'If this email has an account'
    );
    expect(
      fixture.nativeElement.querySelector('password-reset-request-form')
    ).toBeNull();
  });
  it('checks the link before rendering a password form and does not consume mismatched passwords', () => {
    verifyCode.mockReturnValue(of(ok(undefined)));
    resetPassword.mockReturnValue(of(ok(true)));
    const fixture = TestBed.createComponent(PasswordResetContainerComponent);
    fixture.componentRef.setInput('code', 'code');
    fixture.detectChanges();
    expect(verifyCode).toHaveBeenCalledWith('code');
    const component = fixture.componentInstance;
    component.form.setValue({
      password: 'new-password',
      passwordConfirmation: 'different',
    });
    component.submit();
    expect(resetPassword).not.toHaveBeenCalled();
    component.form.setValue({
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });
    component.submit();
    fixture.detectChanges();
    expect(resetPassword).toHaveBeenCalledWith({
      code: 'code',
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });
    expect(component.form.getRawValue().password).toBe('');
    expect(component.code).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Your password has been changed'
    );
  });
  it('does not render a password form for expired or missing links', () => {
    verifyCode.mockReturnValue(of(err(new Error('Expired link'))));
    const fixture = TestBed.createComponent(PasswordResetContainerComponent);
    fixture.componentRef.setInput('code', 'expired');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Expired link');
    fixture.destroy();
    const missing = TestBed.createComponent(PasswordResetContainerComponent);
    missing.componentRef.setInput('code', null);
    missing.detectChanges();
    expect(missing.nativeElement.textContent).toContain(
      'incomplete or unsupported'
    );
    expect(verifyCode).toHaveBeenCalledTimes(1);
  });
  it('restores the reset form after an ambiguous provider failure without announcing success', () => {
    verifyCode.mockReturnValue(of(ok(undefined)));
    resetPassword.mockReturnValue(throwError(() => new Error('timeout')));
    const fixture = TestBed.createComponent(PasswordResetContainerComponent);
    fixture.componentRef.setInput('code', 'code');
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.setValue({
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });
    component.submit();
    fixture.detectChanges();
    expect(component.saving).toBe(false);
    expect(component.completed).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('not confirmed');
  });
});
