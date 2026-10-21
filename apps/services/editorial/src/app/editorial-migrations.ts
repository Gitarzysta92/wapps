import { ContentClassification1791886000000 } from './content-classification/content-classification.migration';
import { HealthObservations1791840018000 } from './application-health/health-observations.migration';
import { EditorialContentUpdates1791840017000 } from './infrastructure/content-update-cursors.migration';
import {
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
} from '@wapps/account-mysql';
import { ArticleCoverCleanup1791676821000 } from './article-covers/article-cover-cleanup.migration';
import { ArticleCoverReferences1791676820000 } from './article-covers/article-cover-references.migration';
import { ArticleCovers1791676819000 } from './article-covers/article-covers.migration';
import { ArticleWorkspace1791676818000 } from './articles/article-workspace.migration';
import { ReleaseWorkspace1791676817000 } from './releases/release-workspace.migration';
import { ApplicationPublication1791676811000 } from './application-publication/application-publication.migration';
import { ApplicationOwnership1791676812000 } from './application-ownership/application-ownership.migration';
import { ApplicationEditing1791676813000 } from './application-drafts/application-editing.migration';
import { ApplicationImages1791676814000 } from './application-media/application-images.migration';
import { ApplicationImageBindings1791676815000 } from './application-media/application-image-bindings.migration';
import { ApplicationImageCleanup1791676816000 } from './application-media/application-image-cleanup.migration';
import { EditorialOwnership1791676802000 } from './infrastructure/editorial-schema.migration';
import { EditorialBackfill1791676803000 } from './infrastructure/editorial-backfill.migration';
import { SuiteWorkspace1791676808000 } from './suites/suite-workspace.migration';
import { SuitePublication1791676809000 } from './suites/suite-publication.migration';
import { SuitePublicationSnapshots1791840009000 } from './suites/suite-publication-snapshots.migration';
import { EditorialAuthorErasure1791840010000 } from './account-erasure/editorial-author-erasure.migration';
import { EditorialMediaAssets1791840011000 } from './application-media/editorial-media-assets.migration';
import { EditorialWorkspaceErasure1791840012000 } from './account-erasure/editorial-workspace-erasure.migration';
import { EditorialAuditErasure1791840013000 } from './account-erasure/editorial-audit-erasure.migration';
import { EditorialErasureCompletion1791840014000 } from './account-erasure/editorial-erasure-completion.migration';
import { ApplicationDrafts1791676810000 } from './application-drafts/application-drafts.migration';

// One ordered roster for API startup, maintenance and real-store qualification.
export const EDITORIAL_MIGRATIONS = [
  EditorialOwnership1791676802000,
  EditorialBackfill1791676803000,
  SuiteWorkspace1791676808000,
  SuitePublication1791676809000,
  ApplicationDrafts1791676810000,
  ApplicationPublication1791676811000,
  ApplicationOwnership1791676812000,
  ApplicationEditing1791676813000,
  ApplicationImages1791676814000,
  ApplicationImageBindings1791676815000,
  ApplicationImageCleanup1791676816000,
  ReleaseWorkspace1791676817000,
  ArticleWorkspace1791676818000,
  ArticleCovers1791676819000,
  ArticleCoverReferences1791676820000,
  ArticleCoverCleanup1791676821000,
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
  SuitePublicationSnapshots1791840009000,
  EditorialAuthorErasure1791840010000,
  EditorialMediaAssets1791840011000,
  EditorialWorkspaceErasure1791840012000,
  EditorialAuditErasure1791840013000,
  EditorialErasureCompletion1791840014000,
  EditorialContentUpdates1791840017000,
  HealthObservations1791840018000,
  ContentClassification1791886000000,
];
