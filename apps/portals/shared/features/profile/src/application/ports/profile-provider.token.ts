import { InjectionToken } from "@angular/core";
import { OwnerDto } from "../../../../../../../../libs/domains/catalog/ownership/src/models/owner.dto";

export const PROFILE_PROVIDER = new InjectionToken<OwnerDto[]>('PROFILE_PROVIDER');