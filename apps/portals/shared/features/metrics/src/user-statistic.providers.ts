import { ApplicationConfig } from "@angular/core";
import { ESTIMATED_USER_SPAN_PROVIDER } from "./application/ports/estimated-user-span-provider.port";
import { UserStatisticService } from "./application/user-statistic.service";
import { EstimatedUserSpanApiService } from "./infrastructure/estimated-user-span-api.service";

export function provideUserStatisticPlatformFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: ESTIMATED_USER_SPAN_PROVIDER, useClass: EstimatedUserSpanApiService },
      UserStatisticService
    ]
  }
}