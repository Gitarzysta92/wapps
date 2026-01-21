import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Result } from "@foundation/standard";
import { IMonetizationProvider, MonetizationDto } from "@domains/catalog/pricing";

@Injectable()
export class MonetizationApiService implements IMonetizationProvider {

  public getMonetizations(): Observable<Result<MonetizationDto[], Error>> {
    return of({
      ok: true,
      value: [
        { id: 0, name: "Free" },
        { id: 1, name: "Freemium" },
        { id: 2, name: "Subscription" },
        { id: 3, name: "Ad-based" },
        { id: 4, name: "One time purchase" },
        { id: 5, name: "Fees" }
      ],
    })
  }
  
}