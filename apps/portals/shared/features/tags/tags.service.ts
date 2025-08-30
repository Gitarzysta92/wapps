import { inject, Injectable } from "@angular/core";
import { defer, map, shareReplay } from "rxjs";
import { TAGS_PROVIDER } from "./ports/tag-provider.port";

@Injectable()
export class TagsService {
  private readonly _tagsProvider = inject(TAGS_PROVIDER);

  public tags$ = defer(() => this._tagsProvider.getTags())
    .pipe(
      map(r => r.value ?? []),
      shareReplay({ bufferSize: 1, refCount: false }))
    ;
} 