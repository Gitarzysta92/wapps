import { ApplicationConfig } from "@angular/core";
import { TAGS_PATH } from "../feature/presentation/ports/tags-path.port";
import { TRENDING_TAGS_PROVIDER } from "./application/ports";
import { TrendingTagsApiService } from "./infrastructure/trending-tags-api.service";
import { TagDtoToTagViewModelMapper } from "./presentation/mappings/trending-tag-dto-to-trending-tag-view-model.mapper";

export function provideTrendingTagsFeature(c: { path: string }): ApplicationConfig {
  return {
    providers: [
      { provide: TAGS_PATH, useValue: c.path },
      { provide: TRENDING_TAGS_PROVIDER, useClass: TrendingTagsApiService },
      TagDtoToTagViewModelMapper
    ]
  }
}