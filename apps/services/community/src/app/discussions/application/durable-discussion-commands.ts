import { DurableDiscussionCommands as DiscussionCommands } from '@sdk/features/discussion/libs/management';
import type { IDiscussionIdentificatorGenerator } from '@sdk/features/discussion/core';
import {
  discussionVoteChange,
  discussionPinChange,
  type DiscussionTarget,
} from '@domains/community';
import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import type {
  DiscussionActor,
  DiscussionWriteRepository,
  ImmutableDiscussionPayloads,
} from './discussion-write.port';
import type { DiscussionTargets } from './discussion-targets.port';
import type { DiscussionMentionDirectory } from './discussion-mentions.port';
import {
  CommunityDiscussionBindings,
  communityDiscussionKey,
} from './community-discussion-binding';
import { communityDiscussionWrites } from './community-discussion-writes';
import type {
  NewDiscussion as KeyedDiscussion,
  DiscussionEdit,
} from '@sdk/features/discussion/libs/management';
export type { DiscussionEdit } from '@sdk/features/discussion/libs/management';
export interface NewDiscussion extends Omit<KeyedDiscussion, 'bindingKey'> {
  target?: DiscussionTarget;
}

/** Wapps HTTP/use-case facade. Product target types never enter the Discussion engine. */
export class DurableDiscussionCommands {
  private readonly engine: DiscussionCommands;
  constructor(
    writes: DiscussionWriteRepository,
    payloads: ImmutableDiscussionPayloads,
    policy: IPolicyEvaluator,
    ids: IDiscussionIdentificatorGenerator,
    targets?: DiscussionTargets,
    mentions?: DiscussionMentionDirectory
  ) {
    this.engine = new DiscussionCommands(
      communityDiscussionWrites(writes),
      payloads,
      policy,
      ids,
      new CommunityDiscussionBindings(policy, targets, mentions)
    );
  }
  create(input: NewDiscussion, actor: DiscussionActor, key: string) {
    const { target, ...fields } = input;
    return this.engine.create(
      {
        ...fields,
        ...(target ? { bindingKey: communityDiscussionKey(target) } : {}),
      },
      actor,
      key
    );
  }
  reply(
    id: string,
    content: unknown,
    actor: DiscussionActor,
    key: string,
    target?: DiscussionTarget
  ) {
    return this.engine.reply(
      id,
      content,
      actor,
      key,
      target ? communityDiscussionKey(target) : undefined
    );
  }
  update(
    id: string,
    input: DiscussionEdit,
    actor: DiscussionActor,
    key: string,
    target?: DiscussionTarget
  ) {
    return this.engine.update(
      id,
      input,
      actor,
      key,
      target ? communityDiscussionKey(target) : undefined
    );
  }
  remove(
    id: string,
    revision: number,
    actor: DiscussionActor,
    key: string,
    target?: DiscussionTarget
  ) {
    return this.engine.remove(
      id,
      revision,
      actor,
      key,
      target ? communityDiscussionKey(target) : undefined
    );
  }
  like(id: string, liked: boolean, actor: DiscussionActor, key: string) {
    return this.engine.like(id, liked, actor, key);
  }
  vote(
    id: string,
    input: unknown,
    actor: DiscussionActor,
    key: string,
    target: DiscussionTarget
  ) {
    return this.engine.vote(
      id,
      discussionVoteChange(input),
      actor,
      key,
      communityDiscussionKey(target)
    );
  }
  pin(
    id: string,
    input: unknown,
    actor: DiscussionActor,
    key: string,
    target: DiscussionTarget
  ) {
    return this.engine.pin(
      id,
      discussionPinChange(input),
      actor,
      key,
      communityDiscussionKey(target)
    );
  }
}
