import {
  publicDiscussionTopic,
  publicCommentId,
  discussionVoteChange,
  discussionPinChange,
  type PublicApplicationDiscussion,
} from '@domains/community';
import {
  PublicDiscussions,
  type PublicDiscussionIndex,
} from './public-discussions';
import { DurableDiscussionCommands } from './durable-discussion-commands';
import { DiscussionQueries } from './discussion-queries';
import type {
  DiscussionWriteRepository,
  DiscussionActor,
} from './discussion-write.port';
import type { DiscussionTargets } from './discussion-targets.port';
import type { DiscussionVotesReader } from './discussion-votes.port';

export class ApplicationDiscussions extends PublicDiscussions<PublicApplicationDiscussion> {
  constructor(
    commands: DurableDiscussionCommands,
    queries: DiscussionQueries,
    writes: DiscussionWriteRepository,
    threads: PublicDiscussionIndex,
    targets: DiscussionTargets,
    publicTenant: string,
    votes: DiscussionVotesReader
  ) {
    super(
      commands,
      queries,
      writes,
      threads,
      targets,
      publicTenant,
      {
        kind: 'application',
        thread: (value, root, resource, actor) => {
          const { title, tags } = publicDiscussionTopic(root);
          if (typeof resource.pinned !== 'boolean')
            throw new Error('Canonical discussion pin state is missing');
          return {
            ...value,
            title,
            tags,
            pinned: resource.pinned,
            canPin: actor?.roles.includes('admin') === true,
          };
        },
      },
      votes
    );
  }

  vote(
    applicationId: string,
    id: string,
    body: unknown,
    actor: DiscussionActor,
    key: string
  ) {
    return this.commands.vote(
      publicCommentId(id),
      discussionVoteChange(body),
      actor,
      key,
      { kind: 'application', id: publicCommentId(applicationId) }
    );
  }

  pin(
    applicationId: string,
    id: string,
    body: unknown,
    actor: DiscussionActor,
    key: string
  ) {
    return this.commands.pin(
      publicCommentId(id),
      discussionPinChange(body),
      actor,
      key,
      { kind: 'application', id: publicCommentId(applicationId) }
    );
  }
}
