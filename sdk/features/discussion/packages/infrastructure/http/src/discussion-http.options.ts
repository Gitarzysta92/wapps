import type { Request } from 'express';
import type {
  BoundDiscussionQueries,
  DiscussionActor,
  DiscussionDiscovery,
  DiscussionQueries,
  DurableDiscussionCommands,
} from '@sdk/features/discussion/libs/management';

export const DISCUSSION_HTTP_OPTIONS = Symbol('DISCUSSION_HTTP_OPTIONS');

export interface DiscussionHttpOptions {
  commands: DurableDiscussionCommands;
  queries: BoundDiscussionQueries;
  unboundQueries: DiscussionQueries;
  discovery: DiscussionDiscovery;
  /** The host authenticates the request and supplies trusted actor context. */
  actor(request: Request, required: boolean): DiscussionActor | null;
  /** Translate consumer adapter failures without importing consumer error classes. */
  error?(error: unknown): unknown;
}
