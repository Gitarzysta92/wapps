import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Result } from "../../../utils/utility-types";
import { delay, Observable, of } from "rxjs";
import { IAuthenticationProviderPort } from "../application/ports";

@Injectable()
export class AuthenticationApiService implements IAuthenticationProviderPort {


  private readonly _httpClient = inject(HttpClient);
  
  public authenticate(c: { login: string, password: string }): Observable<Result<string | null, Error>> {
    
    if (c.password === 'test123') {
      return of({
        value: "87C230D1-43B9-4F22-88E6-8BCECCBC9F20",
      }).pipe(delay(1000))
    } else {
      return of({
        value: null,
        error: new HttpErrorResponse({ status: 401, statusText: "Invalid credentials or token expired" })
      }).pipe(delay(3000))
    }
  }

  public getRefreshedToken(currentToken: string): Observable<Result<string>> {
    throw new Error('Method not implemented.');
  }

}