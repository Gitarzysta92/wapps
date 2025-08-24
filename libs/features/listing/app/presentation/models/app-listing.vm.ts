import { AppListingSliceDto } from "../../application/models/app-listing.dto"
import { AppPreviewDto } from "../../application/models/app-preview.dto";

export type AppListingItemVm = AppPreviewDto & { parentIndex: number };
export type AppListingVm = AppListingSliceDto & { items: Array<AppListingItemVm> };

