export type EditorialResourceKind = 'app' | 'category' | 'tag';

export interface EditorialActor {
  identityId: string;
  tenantId: string;
  roles: string[];
}

export interface EditorialResourceState {
  kind: EditorialResourceKind;
  id: string;
  tenantId: string;
  ownerIdentityId: string | null;
  revision: number;
  deletedAt: number | null;
}

export interface EditorialFields {
  name?: string;
  slug?: string;
  description?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  isPwa?: boolean;
  categoryId?: string | null;
  parentId?: string | null;
  tagIds?: string[];
  platformIds?: string[];
  deviceIds?: string[];
  monetizationModelIds?: string[];
}

export interface EditorialReceipt {
  id: string;
  kind: EditorialResourceKind;
  revision: number;
  deleted: boolean;
  projection: 'pending';
}

export interface EditorialCommandIdentity {
  actor: EditorialActor;
  key: string;
  fingerprint: string;
}

export interface EditorialMutation {
  type: 'create' | 'update' | 'delete';
  kind: EditorialResourceKind;
  id: string;
  fields: EditorialFields;
  previous: EditorialResourceState | null;
  command: EditorialCommandIdentity;
  at: number;
}

export interface EditorialWrites {
  resource(
    kind: EditorialResourceKind,
    id: string
  ): Promise<EditorialResourceState | null>;
  receipt(command: EditorialCommandIdentity): Promise<EditorialReceipt | null>;
  /** Recheck ownership/revision under lock; commit values, state, receipt and outbox atomically. */
  commit(mutation: EditorialMutation): Promise<EditorialReceipt>;
}

export interface EditorialReferenceView {
  id: string;
  name: string;
  slug: string;
}

export interface EditorialResourceView extends EditorialReferenceView {
  revision: number | null;
  description?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  isPwa?: boolean;
  rating?: number | null;
  estimatedNumberOfUsers?: number | null;
  isSuspended?: boolean;
  category?: EditorialReferenceView | null;
  parent?: EditorialReferenceView | null;
  children?: EditorialReferenceView[];
  tags?: EditorialReferenceView[];
  platforms?: EditorialReferenceView[];
  devices?: EditorialReferenceView[];
  monetizationModels?: EditorialReferenceView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EditorialReads {
  list(
    kind: EditorialResourceKind,
    tenantId: string
  ): Promise<EditorialResourceView[]>;
  find(
    kind: EditorialResourceKind,
    id: string,
    tenantId: string
  ): Promise<EditorialResourceView | null>;
}

export class EditorialValidationError extends Error {}
export class EditorialConflictError extends Error {}
export class EditorialNotFoundError extends Error {}
export class EditorialUnavailableError extends Error {}
