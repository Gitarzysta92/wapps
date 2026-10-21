import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import { err, ok, Result } from '@sdk/kernel/standard';
import { EmailVerificationApiService } from './infrastructure/email-verification-api.service';
import { IDENTITY_CONNECTION } from './infrastructure/identity-connection';
import { EMAIL_VERIFICATION } from './application/email-verification.port';
import { EmailVerificationActionComponent } from './presentation/components/email-verification/email-verification-action.component';

describe('email verification transport', () => {
  let http: HttpTestingController;
  let service: EmailVerificationApiService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EmailVerificationApiService,
        {
          provide: IDENTITY_CONNECTION,
          useValue: { mode: 'api', authBaseUrl: '', accountBaseUrl: '' },
        },
      ],
    });
    service = TestBed.inject(EmailVerificationApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads provider-authoritative status without caller-selected identity', async () => {
    const result = firstValueFrom(service.status());
    const request = http.expectOne('/auth/email-verification/status');
    expect(request.request.method).toBe('GET');
    request.flush({ email: 'alice@example.test', verified: false });
    expect(await result).toEqual(
      ok({ email: 'alice@example.test', verified: false })
    );
  });
  it.each([
    {},
    { email: null, verified: true },
    { email: 'alice@example.test', verified: 'true' },
  ])('rejects malformed status: %j', async (body) => {
    const result = firstValueFrom(service.status());
    http.expectOne('/auth/email-verification/status').flush(body);
    expect((await result).ok).toBe(false);
  });
  it('sends a request once and preserves provider throttling', async () => {
    const result = firstValueFrom(service.request());
    const request = http.expectOne('/auth/email-verification/request');
    expect(request.request.body).toEqual({});
    request.flush({}, { status: 429, statusText: 'Too many requests' });
    expect(await result).toEqual(
      err(new Error('Too many attempts. Please wait before trying again.'))
    );
  });
  it('uses POST bodies for codes and never treats missing completion as success', async () => {
    const result = firstValueFrom(service.complete('one_time_code'));
    const request = http.expectOne('/auth/email-verification/complete');
    expect(request.request.body).toEqual({ code: 'one_time_code' });
    request.flush({});
    expect((await result).ok).toBe(false);
  });
});

describe('email verification action presentation', () => {
  const port = { verify: jest.fn(), complete: jest.fn() };
  beforeEach(() => {
    jest.resetAllMocks();
    port.verify.mockReturnValue(of(ok(undefined)));
    port.complete.mockReturnValue(of(ok(undefined)));
    TestBed.configureTestingModule({
      imports: [EmailVerificationActionComponent],
      providers: [{ provide: EMAIL_VERIFICATION, useValue: port }],
    });
    TestBed.overrideComponent(EmailVerificationActionComponent, {
      set: { providers: [] },
    });
  });
  it('checks on opening, requires explicit confirmation, then clears its code', () => {
    const fixture = TestBed.createComponent(EmailVerificationActionComponent);
    fixture.componentRef.setInput('code', 'one_time_code');
    fixture.detectChanges();
    expect(port.verify).toHaveBeenCalledWith('one_time_code');
    expect(port.complete).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.completed()).toBe(true);
    expect(fixture.componentInstance.code).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'email address for this link'
    );
  });
  it('does not reapply an uncertain completion without inspecting again', () => {
    port.complete.mockReturnValue(of(err(new Error('Unknown outcome'))));
    const fixture = TestBed.createComponent(EmailVerificationActionComponent);
    fixture.componentRef.setInput('code', 'code');
    fixture.detectChanges();
    fixture.componentInstance.complete();
    fixture.componentInstance.complete();
    expect(port.complete).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.valid()).toBe(false);
    expect(fixture.componentInstance.completed()).toBe(false);
  });
  it('cancels the previous link check when a different link arrives', () => {
    const previous = new Subject<Result<void, Error>>();
    port.verify
      .mockReturnValueOnce(previous)
      .mockReturnValueOnce(of(err(new Error('New link rejected'))));
    const fixture = TestBed.createComponent(EmailVerificationActionComponent);
    fixture.componentRef.setInput('code', 'first');
    fixture.detectChanges();
    fixture.componentRef.setInput('code', 'second');
    fixture.detectChanges();
    previous.next(ok(undefined));
    expect(fixture.componentInstance.valid()).toBe(false);
    expect(fixture.componentInstance.error()).toBe('New link rejected');
  });
});
