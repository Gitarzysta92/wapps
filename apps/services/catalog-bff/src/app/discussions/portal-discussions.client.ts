import { Injectable } from '@nestjs/common';
import {
  applicationDiscussionCursor,
  commentObject,
  discussionPinChange,
  discussionVoteChange,
  myDiscussionCursor,
  publicDiscussionReply,
  publicDiscussionTopic,
} from '@domains/community';
import type {
  TrustedPortalIdentity,
  TrustedPortalViewer,
} from '../identity/trusted-portal-identity';
import {
  discussionInteger,
  discussionReceipt,
} from './portal-discussions.contract';
import {
  discussionRequest,
  discussionResult,
} from './portal-discussions.request';
import { PortalDiscussionsTransport } from './portal-discussions.transport';
import {
  applicationBoundPage,
  applicationBoundParticipation,
  applicationBoundSelection,
  applicationBoundThread,
  portalDiscussionBinding,
} from './portal-bound-discussions.contract';

export type DiscussionAction =
  | 'create'
  | 'reply'
  | 'edit'
  | 'remove'
  | 'vote'
  | 'pin';

@Injectable()
export class PortalDiscussionsClient {
  constructor(private readonly transport: PortalDiscussionsTransport) {}
  async list(
    actor: TrustedPortalViewer,
    applicationId: string,
    cursor: unknown
  ) {
    this.cursor(cursor, applicationDiscussionCursor);
    const bindingKey = portalDiscussionBinding('application', applicationId);
    const query = new URLSearchParams({
      bindingKey,
      order: 'pinned',
      includeVotes: 'true',
      ...(typeof cursor === 'string' ? { cursor } : {}),
    });
    const raw = await this.transport.send(actor, `/api/discussions?${query}`);
    return discussionResult(() => applicationBoundPage(raw, bindingKey));
  }
  async read(actor: TrustedPortalViewer, applicationId: string, id: string) {
    const bindingKey = portalDiscussionBinding('application', applicationId);
    const raw = await this.transport.send(
      actor,
      `/api/discussions/${id}?${new URLSearchParams({
        bindingKey,
        includeVotes: 'true',
      })}`,
      { thread: true }
    );
    return discussionResult(() => {
      const result = applicationBoundThread(raw, bindingKey, false);
      if (result.id !== id) throw new Error('Unexpected discussion thread');
      return result;
    });
  }
  async mine(actor: TrustedPortalIdentity, cursor: unknown) {
    this.cursor(cursor, myDiscussionCursor);
    const query = new URLSearchParams({
      bindingPrefix: 'application:',
      includeVotes: 'true',
      ...(typeof cursor === 'string' ? { cursor } : {}),
    });
    const raw = await this.transport.send(
      actor,
      `/api/discussions/participation?${query}`
    );
    // Hidden parents may leave a short or empty page with a valid continuation.
    return discussionResult(() => applicationBoundParticipation(raw));
  }
  async select(actor: TrustedPortalViewer, ids: string[]) {
    const raw = await this.transport.send(
      actor,
      `/api/discussions/selection?${new URLSearchParams({
        bindingPrefix: 'application:',
        includeVotes: 'true',
        ids: ids.join(','),
      })}`,
      { selection: true }
    );
    return discussionResult(() => applicationBoundSelection(raw, ids));
  }
  async change(
    actor: TrustedPortalIdentity,
    applicationId: string,
    id: string | null,
    action: DiscussionAction,
    input: unknown,
    key: string
  ) {
    const body = discussionRequest(() => {
      if (action === 'create') return publicDiscussionTopic(input);
      if (action === 'reply') return publicDiscussionReply(input);
      if (action === 'vote') return discussionVoteChange(input);
      if (action === 'pin') return discussionPinChange(input);
      const row = commentObject(
        input,
        action === 'edit'
          ? ['content', 'expectedRevision']
          : ['expectedRevision']
      );
      const expectedRevision = discussionInteger(row.expectedRevision, 1);
      if (action === 'remove') return { expectedRevision };
      const content = commentObject(row.content, [
        'title',
        'tags',
        'displayName',
        'text',
        'mentions',
      ]);
      return {
        expectedRevision,
        content:
          'title' in content || 'tags' in content
            ? publicDiscussionTopic(content)
            : publicDiscussionReply(content),
      };
    });
    const suffix =
      action === 'reply'
        ? '/comments'
        : action === 'vote'
        ? '/vote'
        : action === 'pin'
        ? '/pin'
        : '';
    const raw = await this.transport.send(
      actor,
      `/api/discussions${
        id === null ? '' : '/' + id
      }${suffix}?${new URLSearchParams({
        bindingKey: portalDiscussionBinding('application', applicationId),
      })}`,
      {
        method:
          action === 'create' || action === 'reply'
            ? 'POST'
            : action === 'remove'
            ? 'DELETE'
            : 'PUT',
        body:
          action === 'create'
            ? { content: body, subjectId: applicationId }
            : action === 'reply'
            ? { content: body }
            : body,
        key,
      }
    );
    return discussionResult(() => {
      const result = discussionReceipt(raw);
      if (
        (action === 'create' &&
          (result.id !== result.discussionId || result.revision !== 1)) ||
        (action === 'reply' &&
          (result.id === id ||
            result.id === result.discussionId ||
            result.revision < 2)) ||
        ('expectedRevision' in body &&
          (result.id !== id ||
            result.revision !== body.expectedRevision + 1)) ||
        (action === 'pin' && result.discussionId !== id)
      )
        throw new Error('Unexpected discussion receipt');
      return result;
    });
  }
  private cursor(input: unknown, parse: (value: unknown) => unknown) {
    return discussionRequest(() => {
      if (input === undefined) return '';
      parse(input);
      if (typeof input !== 'string') throw new Error('Invalid cursor');
      return '?' + new URLSearchParams({ cursor: input });
    });
  }
}
