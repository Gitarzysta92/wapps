import type { ContentId } from './content-id';
import type { PayloadRef } from './payload-ref.dto';
import type {
  ContentState,
  ContentVisibility,
  IntrinsicCapability,
} from '../constants';

/**
 * Content as a semantic entity: identity, lifecycle, capabilities.
 * Does not own: payload structure, rendering, storage, search, or relations.
 * Relations are first-class facts in a separate store (ADR-0002).
 */
export type Content = {
  readonly id: ContentId;
  readonly bodyRef: PayloadRef;
  readonly intrinsicCapabilities: readonly IntrinsicCapability[];
  readonly state: ContentState;
  readonly visibility: ContentVisibility;
};
