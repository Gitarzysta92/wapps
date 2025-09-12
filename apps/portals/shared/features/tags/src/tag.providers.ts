import { ApplicationConfig } from "@angular/core";
import { TagsService } from "./application/tags.service";
import { TagApiService } from "./infrastructure/tag-api.service";
import { TAGS_PROVIDER } from "./application/tags-provider.token";

export function provideTagsFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: TAGS_PROVIDER, useClass: TagApiService },
      TagsService
    ]
  }
}
