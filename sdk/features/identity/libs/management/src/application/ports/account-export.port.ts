import type {
  AccountExportArtifact,
  AccountExportEntry,
  AccountExportFailure,
  AccountExportJob,
  AccountExportSourceName,
} from '@sdk/features/identity/core';

export interface AccountExportWork {
  id: string;
  identityId: string;
  token: string;
  attempts: number;
  expiresAt: number;
}
export interface AccountExportStore {
  request(identityId: string, key: string): Promise<AccountExportJob>;
  latest(identityId: string): Promise<AccountExportJob | null>;
  inspect(identityId: string, id: string): Promise<AccountExportJob>;
  cancel(identityId: string, id: string): Promise<AccountExportJob>;
  download(identityId: string, id: string): AsyncIterable<Uint8Array>;
}
export interface AccountExportJobs {
  claim(at: number, token: string): Promise<AccountExportWork | null>;
  heartbeat(work: AccountExportWork, at: number): Promise<boolean>;
  append(
    work: AccountExportWork,
    index: number,
    bytes: Uint8Array,
    at: number
  ): Promise<boolean>;
  complete(
    work: AccountExportWork,
    artifact: AccountExportArtifact,
    at: number
  ): Promise<boolean>;
  failed(
    work: AccountExportWork,
    failure: AccountExportFailure,
    at: number,
    terminal: boolean
  ): Promise<void>;
  purge(at: number): Promise<void>;
}
export interface AccountExportSource {
  readonly name: AccountExportSourceName;
  capture(
    identityId: string,
    signal: AbortSignal
  ): AsyncIterable<AccountExportEntry>;
}
export interface AccountExportArchive {
  build(
    identityId: string,
    sources: readonly AccountExportSource[],
    write: (index: number, bytes: Uint8Array) => Promise<void>,
    signal: AbortSignal
  ): Promise<AccountExportArtifact>;
}
