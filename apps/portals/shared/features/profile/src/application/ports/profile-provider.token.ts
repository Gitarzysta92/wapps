import { InjectionToken } from "@angular/core";
import { IProfileApiService } from "../../../../../../../../libs/domains/customer/src/ports/profile-api-service.port";

export const PROFILE_PROVIDER = new InjectionToken<IProfileApiService>('PROFILE_PROVIDER');