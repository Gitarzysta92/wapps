import { ApplicationConfig } from "@angular/core";
import { TAGS_PROVIDER } from "@domains/catalog/tags";
import { TagsService } from "./application/tags.service";
import { TagApiService } from "./infrastructure/tag-api.service";

export function provideTagsFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: TAGS_PROVIDER, useClass: TagApiService },
      TagsService
    ]
  }
}
