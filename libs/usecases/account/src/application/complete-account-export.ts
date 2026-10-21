import {
  CompleteAccountExport as ExportCoordinator,
  type AccountExportJobs,
  type AccountExportSource,
  type AccountExportArchive,
} from '@sdk/features/identity/libs/management';
import { ACCOUNT_EXPORT_SOURCES } from './account-provider-plan';
export class CompleteAccountExport extends ExportCoordinator {
  constructor(
    jobs: AccountExportJobs,
    sources: readonly AccountExportSource[],
    archive: AccountExportArchive,
    token: () => string,
    now = Date.now
  ) {
    super(jobs, sources, archive, token, now, ACCOUNT_EXPORT_SOURCES);
  }
}
