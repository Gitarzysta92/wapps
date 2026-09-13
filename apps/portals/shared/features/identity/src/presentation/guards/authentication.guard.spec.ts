import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthenticationStorage } from '../../infrastructure/authentication.storage';
import { AuthenticationGuard } from './authentication.guard';

describe('Authentication guard', () => {
  const redirect = {};
  const storage = { getToken: jest.fn() };
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    AuthenticationGuard,
    { provide: AuthenticationStorage, useValue: storage },
    { provide: Router, useValue: { createUrlTree: () => redirect } },
  ] }));
  it('redirects when no session is stored', () => {
    storage.getToken.mockReturnValue(null);
    expect(TestBed.inject(AuthenticationGuard).canActivate()).toBe(redirect);
  });
  it('allows navigation with a stored session', () => {
    storage.getToken.mockReturnValue('token');
    expect(TestBed.inject(AuthenticationGuard).canActivate()).toBe(true);
  });
});
