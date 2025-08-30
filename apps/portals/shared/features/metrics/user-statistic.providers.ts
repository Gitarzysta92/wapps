import { ApplicationConfig } from "@angular/core";
import { ESTIMATED_USER_SPAN_PROVIDER, UserStatisticService } from "../../../../../../../libs/features/listing/statistic/users/application";
import { EstimatedUserSpanApiService } from "./infrastructure/estimated-user-span-api.service";

export function provideUserStatisticPlatformFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: ESTIMATED_USER_SPAN_PROVIDER, useClass: EstimatedUserSpanApiService },
      UserStatisticService
    ]
  }
}