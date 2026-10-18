import { ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import type { IDiscussionIdentificatorGenerator } from '@sdk/features/discussion/core';
import {
  BoundDiscussionQueries,
  DiscussionDiscovery,
  DiscussionQueries,
  DiscussionValidationError,
  DurableDiscussionCommands,
  type DiscussionProjectionReader,
} from '@sdk/features/discussion/libs/management';
import type { DiscussionHttpOptions } from '@sdk/features/discussion/http';
import { PublicCommentInputError } from '@domains/community';
import {
  extractAuthUser,
  type AuthenticatedRequest,
} from '../decorators/auth-user.decorator';
import { discussionActor } from './discussion-actor';
import type {
  DiscussionWriteRepository,
  ImmutableDiscussionPayloads,
} from './application/discussion-write.port';
import type { DiscussionTargets } from './application/discussion-targets.port';
import type { DiscussionMentionDirectory } from './application/discussion-mentions.port';
import { CommunityDiscussionBindings } from './application/community-discussion-binding';
import { communityDiscussionWrites } from './application/community-discussion-writes';
import { MysqlBoundDiscussionIndex } from './infrastructure/mysql-bound-discussion-index';
import { MysqlDiscussionVotes } from './infrastructure/mysql-discussion-votes';
import { MysqlBoundDiscussionParticipation } from './infrastructure/mysql-bound-discussion-participation';

/** Wapps supplies policy, historical receipts and adapters; HTTP handlers only see capability ports. */
export function communityDiscussionHttp(options: {
  source: DataSource;
  writes: DiscussionWriteRepository;
  projections: DiscussionProjectionReader;
  payloads: ImmutableDiscussionPayloads;
  policy: IPolicyEvaluator;
  ids: IDiscussionIdentificatorGenerator;
  targets: DiscussionTargets;
  publicTenant: string;
  mentions?: DiscussionMentionDirectory;
}): DiscussionHttpOptions {
  const {
    source,
    projections,
    payloads,
    policy,
    ids,
    targets,
    publicTenant,
    mentions,
  } = options;
  const writes = communityDiscussionWrites(options.writes);
  const bindings = new CommunityDiscussionBindings(policy, targets, mentions);
  const unboundQueries = new DiscussionQueries(
    writes,
    projections,
    publicTenant,
    bindings
  );
  const queries = new BoundDiscussionQueries(
    unboundQueries,
    writes,
    new MysqlBoundDiscussionIndex(source),
    bindings,
    publicTenant,
    new MysqlDiscussionVotes(source)
  );
  return {
    commands: new DurableDiscussionCommands(
      writes,
      payloads,
      policy,
      ids,
      bindings
    ),
    queries,
    unboundQueries,
    discovery: new DiscussionDiscovery(
      queries,
      writes,
      bindings,
      new MysqlBoundDiscussionParticipation(source),
      async (actor) => {
        const action = 'discussion.my-topics.read';
        const result = await policy.evaluate({
          identityId: actor.identityId,
          tenantId: actor.tenantId,
          timestamp: Date.now(),
          action,
          actionName: action,
          subject: { roles: actor.roles },
          resource: {
            type: 'my-discussion-workspace',
            id: actor.identityId,
            tenantId: actor.tenantId,
          },
        });
        if (!result.ok) throw result.error;
        if (result.value !== true) throw new PermissionDeniedError(action);
      },
      publicTenant
    ),
    actor: (request, required) =>
      discussionActor(
        extractAuthUser(request as AuthenticatedRequest, !required)
      ),
    error: (error) =>
      error instanceof PublicCommentInputError
        ? new DiscussionValidationError(error.message)
        : error instanceof CanonicalIdentityAccessDenied
        ? new ForbiddenException('Account access denied')
        : error,
  };
}
