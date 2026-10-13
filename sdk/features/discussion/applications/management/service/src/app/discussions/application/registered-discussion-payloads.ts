import { createHash, randomUUID } from 'node:crypto';
import {
  DISCUSSION_MAX_PAYLOAD_BYTES,
  type DiscussionPayloadReference,
} from '@apps/shared';
import {
  accountErasureRequest,
  isCanonicalIdentityId,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import {
  DiscussionValidationError,
  type DiscussionPayloadScope,
  type ImmutableDiscussionPayloads,
} from './discussion-write.port';

export interface DiscussionPayloadRegistry {
  reserve(
    nodeId: string,
    reference: DiscussionPayloadReference,
    scope: DiscussionPayloadScope
  ): Promise<void>;
  uploaded(
    nodeId: string,
    reference: DiscussionPayloadReference,
    scope: DiscussionPayloadScope
  ): Promise<void>;
  /** Durably claims only obsolete references under the exact owning-service erasure request. */
  retiring(
    request: AccountErasureRequest
  ): Promise<DiscussionPayloadReference[]>;
  retired(request: AccountErasureRequest, key: string): Promise<void>;
}

export interface DiscussionPayloadObjects {
  put(reference: DiscussionPayloadReference, body: Buffer): Promise<void>;
  /** Retains a permanent empty marker; a paused conditional upload cannot recreate bytes. */
  retire(reference: DiscussionPayloadReference): Promise<void>;
}

const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const objectKey = new RegExp(`^discussions/(${uuid})/versions/${uuid}\\.json$`);

export function assertDiscussionPayloadReference(
  nodeId: string,
  reference: DiscussionPayloadReference
): void {
  if (
    typeof nodeId !== 'string' ||
    typeof reference.key !== 'string' ||
    objectKey.exec(reference.key)?.[1] !== nodeId ||
    !/^[a-f0-9]{64}$/.test(reference.sha256) ||
    !Number.isSafeInteger(reference.bytes) ||
    reference.bytes < 1 ||
    reference.bytes > DISCUSSION_MAX_PAYLOAD_BYTES
  )
    throw new DiscussionValidationError('Invalid discussion payload reference');
}

export function assertDiscussionPayloadScope(
  scope: DiscussionPayloadScope
): void {
  if (
    !isCanonicalIdentityId(scope.ownerIdentityId) ||
    (scope.actorIdentityId !== null &&
      !isCanonicalIdentityId(scope.actorIdentityId)) ||
    !isCanonicalIdentityId(scope.tenantId)
  )
    throw new DiscussionValidationError('Invalid discussion payload ownership');
}

export class RegisteredDiscussionPayloads
  implements ImmutableDiscussionPayloads
{
  constructor(
    private readonly registry: DiscussionPayloadRegistry,
    private readonly objects: DiscussionPayloadObjects,
    private readonly versionId: () => string = randomUUID
  ) {}

  async put(nodeId: string, body: Buffer, scope: DiscussionPayloadScope) {
    assertDiscussionPayloadScope(scope);
    const reference = {
      key: `discussions/${nodeId}/versions/${this.versionId()}.json`,
      sha256: createHash('sha256').update(body).digest('hex'),
      bytes: body.length,
    };
    assertDiscussionPayloadReference(nodeId, reference);
    await this.registry.reserve(nodeId, reference, scope);
    await this.objects.put(reference, body);
    await this.registry.uploaded(nodeId, reference, scope);
    return reference;
  }
}

/** A cleanup prerequisite; retiring obsolete objects alone never completes service erasure. */
export class RetireDiscussionPayloads {
  constructor(
    private readonly registry: DiscussionPayloadRegistry,
    private readonly objects: DiscussionPayloadObjects
  ) {}

  async advance(input: AccountErasureRequest): Promise<number> {
    const request = accountErasureRequest(input);
    const references = await this.registry.retiring(request);
    for (const reference of references) {
      await this.objects.retire(reference);
      await this.registry.retired(request, reference.key);
    }
    return references.length;
  }
}
