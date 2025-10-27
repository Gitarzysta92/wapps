import { OverviewDto } from "../application/overview.dto";

export type OverviewVm = {
  isLoading: boolean;
  error?: Error;
} & OverviewDto;