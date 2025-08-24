import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { IEstimatedUserSpanProvider, EstimatedUserSpanDto } from "../application";
import { Result } from "@standard";

@Injectable()
export class EstimatedUserSpanApiService implements IEstimatedUserSpanProvider {

  public getEstimatedUserSpans(): Observable<Result<EstimatedUserSpanDto[], Error>> {
    return of({
      value: [
        { id: 0, name: "0-1000" },
        { id: 1, name: "1000-10000" },
        { id: 2, name: "10000-100000" },
        { id: 3, name: "100000-1000000" },
        { id: 4, name: "1000000+" }
      ],
    })
  }
  
}