import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { 
  IAuthenticationHandler, 
  AuthenticationProvider, 
  AuthenticationMethodDto 
} from "@domains/identity/authentication";
import { Result } from "@foundation/standard";

/**
 * Mock authentication service for development/testing.
 * In production, use BffAuthenticationService instead.
 */
@Injectable()
export class AuthenticationApiService implements IAuthenticationHandler {

  private readonly _httpClient = inject(HttpClient);
  
  public authenticate(c: { login: string, password: string }): Observable<Result<string, Error>> {
    console.log('[MOCK] authenticate', c);
    if (c.password === 'test123') {
      return of({
        ok: true as const,
        value: "87C230D1-43B9-4F22-88E6-8BCECCBC9F20",
      }).pipe(delay(1000));
    } else {
      return of({
        ok: false as const,
        error: new Error("Invalid credentials or token expired")
      }).pipe(delay(1500));
    }
  }

  public authenticateWithProvider(provider: AuthenticationProvider): Observable<Result<string, Error>> {
    console.log('[MOCK] authenticateWithProvider', provider);
    
    // Mock successful authentication for all providers
    return of({
      ok: true as const,
      value: `MOCK-TOKEN-${provider}-${Date.now()}`,
    }).pipe(delay(1000));
  }

  public getAvailableMethods(): Observable<AuthenticationMethodDto[]> {
    // Return all methods for development/testing
    return of([
      { 
        provider: AuthenticationProvider.EMAIL_PASSWORD, 
        displayName: 'Email & Password', 
        icon: 'mail',
        enabled: true 
      },
      { 
        provider: AuthenticationProvider.GOOGLE, 
        displayName: 'Google', 
        icon: 'google',
        enabled: true 
      },
      { 
        provider: AuthenticationProvider.GITHUB, 
        displayName: 'GitHub', 
        icon: 'github',
        enabled: true 
      },
      { 
        provider: AuthenticationProvider.ANONYMOUS, 
        displayName: 'Continue as Guest', 
        icon: 'user',
        enabled: true 
      },
    ]).pipe(delay(200));
  }

  public getRefreshedToken(currentToken: string): Observable<Result<string>> {
    return of({
      ok: true as const,
      value: `MOCK-REFRESHED-TOKEN-${Date.now()}`,
    }).pipe(delay(500));
  }
}