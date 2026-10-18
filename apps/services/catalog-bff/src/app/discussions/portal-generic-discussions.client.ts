import { Injectable } from '@nestjs/common';
import type {
  TrustedPortalIdentity,
  TrustedPortalViewer,
} from '../identity/trusted-portal-identity';
import { discussionReceipt } from './portal-discussions.contract';
import {
  discussionRequest,
  discussionResult,
} from './portal-discussions.request';
import { PortalDiscussionsTransport } from './portal-discussions.transport';
import {
  genericDiscussionChange,
  genericDiscussionList,
  genericDiscussionThread,
  type GenericDiscussionAction,
} from './portal-generic-discussions.contract';

@Injectable()
export class PortalGenericDiscussionsClient {
  constructor(private readonly transport: PortalDiscussionsTransport) {}

  async list(actor: TrustedPortalViewer) {
    const raw = await this.transport.send(actor, '/api/discussions');
    return discussionResult(() => genericDiscussionList(raw));
  }

  async read(actor: TrustedPortalViewer, id: string) {
    const raw = await this.transport.send(actor, `/api/discussions/${id}`, {
      thread: true,
    });
    return discussionResult(() => genericDiscussionThread(raw, id));
  }

  async change(
    actor: TrustedPortalIdentity,
    id: string | null,
    action: GenericDiscussionAction,
    input: unknown,
    key: string
  ) {
    const body = discussionRequest(() =>
      genericDiscussionChange(action, input)
    );
    const path =
      action === 'like' || action === 'unlike'
        ? (`/api/discussions/comments/${id}/like` as const)
        : (`/api/discussions${id === null ? '' : '/' + id}${
            action === 'reply' ? '/comments' : ''
          }` as const);
    const raw = await this.transport.send(actor, path, {
      method:
        action === 'remove' || action === 'unlike'
          ? 'DELETE'
          : action === 'edit'
          ? 'PUT'
          : 'POST',
      body,
      key,
      generic: true,
    });
    return discussionResult(() => {
      const receipt = discussionReceipt(raw);
      if (
        (action === 'create' &&
          (receipt.id !== receipt.discussionId || receipt.revision !== 1)) ||
        (action === 'reply' &&
          (receipt.id === id ||
            receipt.id === receipt.discussionId ||
            receipt.revision < 2)) ||
        (id !== null &&
          action !== 'reply' &&
          receipt.id.toLowerCase() !== id.toLowerCase()) ||
        (body &&
          typeof body.expectedRevision === 'number' &&
          receipt.revision !== body.expectedRevision + 1)
      )
        throw new Error('Unexpected discussion receipt');
      return receipt;
    });
  }
}
