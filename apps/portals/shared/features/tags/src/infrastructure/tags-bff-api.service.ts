import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { Result } from "@standard";
import { ITagsProvider, TagDto } from "@domains/catalog/tags";

@Injectable()
export class TagsBffApiService implements ITagsProvider {
  private readonly _http = inject(HttpClient);
  private readonly _apiUrl = '/api'; // Routes through Kong to catalog-bff

  getTags(): Observable<Result<TagDto[], Error>> {
    return this._http.get<TagDto[]>(`${this._apiUrl}/catalog/tags`).pipe(
      map(tags => ({ ok: true as const, value: tags })),
      catchError(err => of({ ok: false as const, error: err }))
    );
  }
}

