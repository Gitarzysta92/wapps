import { ApplicationConfig } from "@angular/core";
import { TagsService } from "./application/tags.service";
import { TagApiService } from "./infrastructure/tag-api.service";
import { TagsBffApiService } from "./infrastructure/tags-bff-api.service";
import { TAGS_PROVIDER } from "./application/tags-provider.token";

export function provideTagsFeature(config?: { useBff?: boolean }): ApplicationConfig {
  const useRealApi = config?.useBff ?? true;
  
  return {
    providers: [
      { 
        provide: TAGS_PROVIDER, 
        useClass: useRealApi ? TagsBffApiService : TagApiService 
      },
      TagsService
    ]
  };
}
