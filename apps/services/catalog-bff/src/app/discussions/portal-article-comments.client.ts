import { Injectable } from '@nestjs/common';
import { commentObject, publicCommentContent } from '@domains/community';
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
import { articleCommentCursor } from './portal-article-comments.contract';
import {
  articleBoundPage,
  articleBoundThread,
  portalDiscussionBinding,
} from './portal-bound-discussions.contract';

export type ArticleCommentAction = 'create' | 'reply' | 'edit' | 'remove';

@Injectable()
export class PortalArticleCommentsClient {
  constructor(private readonly transport: PortalDiscussionsTransport) {}
  async list(actor: TrustedPortalViewer, articleId: string, cursor: unknown) {
    const bindingKey = portalDiscussionBinding('article', articleId);
    const query = discussionRequest(() => {
      const values = new URLSearchParams({ bindingKey });
      if (cursor === undefined) return values;
      articleCommentCursor(cursor);
      if (typeof cursor !== 'string') throw new Error('Invalid cursor');
      values.set('cursor', cursor);
      return values;
    });
    const raw = await this.transport.send(actor, `/api/discussions?${query}`);
    return discussionResult(() => articleBoundPage(raw, bindingKey));
  }
  async read(actor: TrustedPortalViewer, articleId: string, id: string) {
    const bindingKey = portalDiscussionBinding('article', articleId);
    const raw = await this.transport.send(
      actor,
      `/api/discussions/${id}?${new URLSearchParams({ bindingKey })}`,
      { thread: true }
    );
    return discussionResult(() => {
      const result = articleBoundThread(raw, bindingKey, false);
      if (result.id !== id) throw new Error('Unexpected comment thread');
      return result;
    });
  }
  async change(
    actor: TrustedPortalIdentity,
    articleId: string,
    id: string | null,
    action: ArticleCommentAction,
    input: unknown,
    key: string
  ) {
    const body = discussionRequest(() => {
      if (action === 'create' || action === 'reply')
        return publicCommentContent(input);
      const row = commentObject(
        input,
        action === 'edit'
          ? ['content', 'expectedRevision']
          : ['expectedRevision']
      );
      return {
        expectedRevision: discussionInteger(row.expectedRevision, 1),
        ...(action === 'edit'
          ? { content: publicCommentContent(row.content) }
          : {}),
      };
    });
    const raw = await this.transport.send(
      actor,
      `/api/discussions${id === null ? '' : '/' + id}${
        action === 'reply' ? '/comments' : ''
      }?${new URLSearchParams({
        bindingKey: portalDiscussionBinding('article', articleId),
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
            ? { content: body, subjectId: articleId }
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
          (result.id !== id || result.revision !== body.expectedRevision + 1))
      )
        throw new Error('Unexpected comment receipt');
      return result;
    });
  }
}
