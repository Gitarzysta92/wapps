import type { ContentId } from './content-id';
import type { PayloadRef } from './payload-ref.dto';
import type {
  ContentState,
  ContentVisibility,
  IntrinsicCapability,
} from '../constants';

export type ContentRelationRef = {
  readonly kind: string;
  readonly targetId: ContentId;
};

/**
 * Content as a semantic entity: identity, lifecycle, capabilities, relations.
 * Does not own: payload structure, rendering, storage, or search.
 */
export type Content = {
  readonly id: ContentId;
  readonly bodyRef: PayloadRef;
  readonly intrinsicCapabilities: readonly IntrinsicCapability[];
  readonly state: ContentState;
  readonly visibility: ContentVisibility;
  readonly relations?: readonly ContentRelationRef[];
};
