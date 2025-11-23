import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { IAuthenticationHandler } from "@domains/identity/authentication";
import { Result } from "@standard";

@Injectable()
export class AuthenticationApiService implements IAuthenticationHandler {

  private readonly _httpClient = inject(HttpClient);
  
  public authenticate(c: { login: string, password: string }): Observable<Result<string, Error>> {
    console.log('authenticate', c);
    if (c.password === 'test123') {
      console.log('authenticate', c);
      return of({
        ok: true as const,
        value: "87C230D1-43B9-4F22-88E6-8BCECCBC9F20",
      }).pipe(delay(1000));
    } else {
      return of({
        ok: false as const,
        value: null,
        error: new HttpErrorResponse({ status: 401, statusText: "Invalid credentials or token expired" })
      }).pipe(delay(3000));
    }
  }

  public getRefreshedToken(currentToken: string): Observable<Result<string>> {
    throw new Error('Method not implemented.');
  }

}