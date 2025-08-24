import { inject, Injectable } from "@angular/core";
import { TagDto } from "../../../feature/application/models";
import { TagVm } from "../../../feature/presentation/models";
import { TAGS_PATH } from "../../../feature/presentation/ports/tags-path.port";

@Injectable()
export class TagDtoToTagViewModelMapper {
  private readonly _tagsPath = inject(TAGS_PATH);
  map(c: TagDto): TagVm {
    return {
      ...c,
      path: `${this._tagsPath}/${c.slug}`
    }
  }
}