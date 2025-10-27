import { AppRecordDto } from "@domains/catalog/record";
import { AppCompatibilityDto } from "@domains/catalog/compatibility";
import { AppEstimatedUserSpanDto } from "@domains/catalog/metrics";
import { AppOwnershipDto } from "@domains/catalog/ownership";
import { AppMonetizationDto } from "@domains/catalog/pricing";
import { AppReferencesDto } from "@domains/catalog/references";

export type OverviewDto =
  AppRecordDto &
  AppCompatibilityDto &
  AppEstimatedUserSpanDto &
  AppOwnershipDto &
  AppMonetizationDto &
  AppReferencesDto;