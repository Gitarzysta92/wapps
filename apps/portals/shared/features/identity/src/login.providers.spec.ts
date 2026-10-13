import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import {
  provideIdentityLoginFeature,
  IdentityLoginFeatureConfig,
} from './login.providers';
import { provideIdentityManagementFeature } from './management.providers';
import { IDENTITY_PROVIDER } from './application/identity-provider.token';
import { AUTHENTICATION_HANDLER } from './application/authentication-handler.token';
import { BffAuthenticationService } from './infrastructure/bff/bff-authentication.service';

describe('identity composition', () => {
  const config: IdentityLoginFeatureConfig = {
    mode: 'api',
    authBffUrl: '',
    accountApiUrl: '',
    validationMessages: { email: [], password: [] },
  };
  it('selects real HTTP for an explicitly selected same-origin gateway', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideIdentityLoginFeature(config).providers,
      ],
    });
    expect(TestBed.inject(AUTHENTICATION_HANDLER)).toBeInstanceOf(
      BffAuthenticationService
    );
  });
  it('keeps demo identity explicit even when management is composed later', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideIdentityLoginFeature({ ...config, mode: 'demo' }).providers,
        ...provideIdentityManagementFeature().providers,
      ],
    });
    expect(
      await firstValueFrom(TestBed.inject(IDENTITY_PROVIDER).getIdentity())
    ).toEqual({ ok: true, value: { id: 'demo', name: 'Demo account' } });
  });
  it.each([
    'https://example.test/api',
    'https://user:secret@example.test',
    'javascript:alert(1)',
  ])('rejects invalid endpoints: %s', (endpoint) => {
    expect(() =>
      provideIdentityLoginFeature({ ...config, authBffUrl: endpoint })
    ).toThrow();
  });
});
