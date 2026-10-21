import { Injectable } from '@nestjs/common';
import {
  DurableDiscussionCommands,
  DiscussionEdit,
  NewDiscussion,
} from './application/durable-discussion-commands';
import { DiscussionQueries } from './application/discussion-queries';
import { DiscussionActor } from './application/discussion-write.port';

@Injectable()
export class DiscussionsService {
  constructor(
    private readonly commands: DurableDiscussionCommands,
    private readonly queries: DiscussionQueries
  ) {}
  findAll(actor: DiscussionActor | null) {
    return this.queries.findAll(actor);
  }
  findOne(id: string, actor: DiscussionActor | null) {
    return this.queries.findOne(id, actor);
  }
  create(data: NewDiscussion, actor: DiscussionActor, key: string) {
    return this.commands.create(data, actor, key);
  }
  reply(
    parentId: string,
    content: unknown,
    actor: DiscussionActor,
    key: string
  ) {
    return this.commands.reply(parentId, content, actor, key);
  }
  update(
    id: string,
    data: DiscussionEdit,
    actor: DiscussionActor,
    key: string
  ) {
    return this.commands.update(id, data, actor, key);
  }
  remove(id: string, revision: number, actor: DiscussionActor, key: string) {
    return this.commands.remove(id, revision, actor, key);
  }
  likeComment(id: string, actor: DiscussionActor, key: string) {
    return this.commands.like(id, true, actor, key);
  }
  unlikeComment(id: string, actor: DiscussionActor, key: string) {
    return this.commands.like(id, false, actor, key);
  }
}
