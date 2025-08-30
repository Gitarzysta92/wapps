import { ApplicationConfig } from "@angular/core";
import { TAGS_PROVIDER } from "./application/ports/tag-provider.port";
import { TagsService } from "./application/tags.service";
import { TagApiService } from "./infrastructure/tag-api.service";


export function provideListingTagFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: TAGS_PROVIDER, useClass: TagApiService },
      TagsService
    ]
  }
}