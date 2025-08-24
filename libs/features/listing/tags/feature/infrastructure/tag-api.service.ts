import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { ITagsProvider } from "../application/ports/tag-provider.port";
import { Result } from "@standard";
import { TagDto } from "../application/models";


@Injectable()
export class TagApiService implements ITagsProvider {

  public getTags(): Observable<Result<TagDto[], Error>> {
    return of({
      value: [
        { id: 0, slug: "Web", name: "Web" },
        
      ],
    })
  }
  
}