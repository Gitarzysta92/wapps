import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { ITagsProvider, TagDto } from "@domains/catalog/tags";
import { Result } from "@foundation/standard";

@Injectable()
export class TagApiService implements ITagsProvider {

  public getTags(): Observable<Result<TagDto[], Error>> {
    return of({
      ok: true,
      value: [
        { id: 0, slug: "Web", name: "Web" },
      ],
    })
  }
  
}
