import { createHash } from 'node:crypto';
import type { DiscussionPayloadReference } from '@apps/shared';
import {
  accountErasureRequest,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import type { DiscussionTarget } from '@sdk/features/discussion/core';
import { anonymousDiscussionPayload } from './discussion-anonymity';
import { assertDiscussionPayloadReference } from './registered-discussion-payloads';

export interface DiscussionErasureNode {
  id: string;
  discussionId: string;
  tenantId: string;
  target: DiscussionTarget | null;
  kind: 'discussion' | 'comment';
  state: string;
  visibility: string;
  deletedAt: number | null;
  rootState: string;
  rootVisibility: string;
  rootDeletedAt: number | null;
  payload: DiscussionPayloadReference | null;
  retain: boolean;
}
export interface DiscussionContributionErasureRepository {
  next(request: AccountErasureRequest): Promise<DiscussionErasureNode | null>;
  reserve(
    request: AccountErasureRequest,
    node: DiscussionErasureNode,
    reference: DiscussionPayloadReference
  ): Promise<boolean>;
  commit(
    request: AccountErasureRequest,
    node: DiscussionErasureNode,
    reference: DiscussionPayloadReference | null
  ): Promise<void>;
}
export interface DiscussionErasurePayloads {
  read(
    nodeId: string,
    reference: DiscussionPayloadReference,
    signal: AbortSignal
  ): Promise<unknown>;
  put(reference: DiscussionPayloadReference, body: Buffer): Promise<void>;
}

/** Advances canonical author removal; private/audit/projection cleanup must still finish before a receipt. */
export class AnonymizeDiscussionContributions {
  constructor(
    private readonly repository: DiscussionContributionErasureRepository,
    private readonly payloads: DiscussionErasurePayloads
  ) {}

  async advance(input: AccountErasureRequest): Promise<boolean> {
    const request = accountErasureRequest(input);
    const node = await this.repository.next(request);
    if (!node) return false;
    if (!node.retain) {
      await this.repository.commit(request, node, null);
      return true;
    }
    if (!node.payload)
      throw new Error('Retained contribution has no immutable payload');
    const content = await this.payloads.read(
      node.id,
      node.payload,
      AbortSignal.timeout(20_000)
    );
    const body = Buffer.from(
      JSON.stringify(anonymousDiscussionPayload({ content }))
    );
    const sha256 = createHash('sha256').update(body).digest('hex');
    const hash = createHash('sha256')
      .update(
        JSON.stringify([
          'discussion-author-erasure-v1',
          node.id,
          request.revision,
          node.payload,
          sha256,
        ])
      )
      .digest('hex');
    const version = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(
      13,
      16
    )}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const reference = {
      key: `discussions/${node.id}/versions/${version}.json`,
      sha256,
      bytes: body.length,
    };
    assertDiscussionPayloadReference(node.id, reference);
    // Another worker may have anonymized or tombstoned the node while its body was read.
    if (!(await this.repository.reserve(request, node, reference))) return true;
    await this.payloads.put(reference, body);
    await this.repository.commit(request, node, reference);
    return true;
  }
}
