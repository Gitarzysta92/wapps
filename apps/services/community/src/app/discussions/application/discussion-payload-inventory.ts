import { createHash } from 'node:crypto';
import {
  DISCUSSION_MAX_PAYLOAD_BYTES,
  type DiscussionPayloadReference,
} from '@apps/shared';

export interface DiscussionInventoryProgress {
  revision: number;
  after: string;
  completedAt: number | null;
  legacyWritersStoppedAt: number | null;
  lastPlanHash: string | null;
}
export interface DiscussionInventoryObject {
  key: string;
  etag: string;
  bytes: number;
}
export interface DiscussionInventoryDecision {
  kind:
    | 'tracked'
    | 'adopt'
    | 'copy-legacy'
    | 'retire-orphan'
    | 'retire-erased'
    | 'blocked';
  nodeId: string | null;
  ownerIdentityId: string | null;
  tenantId: string | null;
  erasureRevision: number | null;
  reason: string | null;
}
export interface DiscussionInventoryItem extends DiscussionInventoryObject {
  decision: DiscussionInventoryDecision;
}
export interface DiscussionInventoryPlan {
  progress: DiscussionInventoryProgress;
  items: DiscussionInventoryItem[];
  more: boolean;
  fingerprint: string;
}
export interface DiscussionPayloadInventoryRepository {
  exclusive<T>(work: () => Promise<T>): Promise<T>;
  progress(): Promise<DiscussionInventoryProgress>;
  classify(key: string): Promise<DiscussionInventoryDecision>;
  adopt(
    item: DiscussionInventoryItem,
    reference: DiscussionPayloadReference
  ): Promise<void>;
  prepareCopy(
    item: DiscussionInventoryItem,
    reference: DiscussionPayloadReference
  ): Promise<void>;
  confirmCopy(
    item: DiscussionInventoryItem,
    reference: DiscussionPayloadReference
  ): Promise<void>;
  retire(
    item: DiscussionInventoryItem,
    writeMarker: () => Promise<void>,
    preserved?: DiscussionPayloadReference
  ): Promise<void>;
  advance(
    previous: DiscussionInventoryProgress,
    key: string
  ): Promise<DiscussionInventoryProgress>;
  finish(
    previous: DiscussionInventoryProgress,
    fingerprint: string,
    complete: boolean
  ): Promise<DiscussionInventoryProgress>;
}
export interface DiscussionPayloadInventoryObjects {
  requireUnversioned(): Promise<void>;
  page(
    after: string
  ): Promise<{ objects: DiscussionInventoryObject[]; more: boolean }>;
  read(
    object: DiscussionInventoryObject
  ): Promise<{ body: Buffer; retired: boolean }>;
  copy(reference: DiscussionPayloadReference, body: Buffer): Promise<void>;
  retire(object: DiscussionInventoryObject): Promise<void>;
}

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const pattern = new RegExp(
  `^discussions/(${uuid})/(content|versions/${uuid}\\.json)$`
);
export function discussionInventoryKey(
  key: string
): { nodeId: string; legacy: boolean } | null {
  const match = pattern.exec(key);
  return match ? { nodeId: match[1], legacy: match[2] === 'content' } : null;
}
function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
function copiedReference(
  item: DiscussionInventoryItem,
  body: Buffer
): DiscussionPayloadReference {
  const sha256 = hash(body);
  const hex = hash(
    JSON.stringify(['legacy-discussion-copy-v1', item.key, item.etag, sha256])
  ).slice(0, 32);
  const version = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(
    13,
    16
  )}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
  return {
    key: `discussions/${item.decision.nodeId}/versions/${version}.json`,
    sha256,
    bytes: body.length,
  };
}

/** A maintenance prerequisite: it never changes public content or completes an account erasure. */
export class InventoryDiscussionPayloads {
  constructor(
    private readonly repository: DiscussionPayloadInventoryRepository,
    private readonly objects: DiscussionPayloadInventoryObjects
  ) {}

  async plan(): Promise<DiscussionInventoryPlan> {
    await this.objects.requireUnversioned();
    const progress = await this.repository.progress();
    const page =
      progress.completedAt === null
        ? await this.objects.page(progress.after)
        : { objects: [], more: false };
    const items: DiscussionInventoryItem[] = [];
    for (const object of page.objects) {
      const decision = await this.repository.classify(object.key);
      if (
        ['adopt', 'copy-legacy'].includes(decision.kind) &&
        object.bytes > DISCUSSION_MAX_PAYLOAD_BYTES
      ) {
        decision.kind = 'blocked';
        decision.reason = 'Historical payload exceeds the supported bound';
      }
      items.push({ ...object, decision });
    }
    const plan = { progress, items, more: page.more };
    return { ...plan, fingerprint: hash(JSON.stringify(plan)) };
  }

  async apply(
    fingerprint: string,
    legacyWritersStopped: boolean
  ): Promise<DiscussionInventoryProgress> {
    if (!legacyWritersStopped || !/^[a-f0-9]{64}$/.test(fingerprint))
      throw new Error(
        'Payload inventory requires a reviewed fingerprint and stopped legacy writers'
      );
    return this.repository.exclusive(async () => {
      await this.objects.requireUnversioned();
      const existing = await this.repository.progress();
      if (existing.lastPlanHash === fingerprint) return existing;
      const plan = await this.plan();
      if (plan.fingerprint !== fingerprint)
        throw new Error(
          'Inventory checkpoint, objects or authority changed; review a new plan'
        );
      if (existing.completedAt !== null) return existing;
      let progress = existing;
      for (const item of plan.items) {
        if (item.decision.kind === 'blocked')
          throw new Error(
            `Inventory blocked at ${item.key}: ${item.decision.reason}`
          );
        if (['adopt', 'copy-legacy'].includes(item.decision.kind)) {
          const snapshot = await this.objects.read(item);
          if (!snapshot.retired) {
            try {
              const content: unknown = JSON.parse(
                new TextDecoder('utf-8', { fatal: true }).decode(snapshot.body)
              );
              if (
                !content ||
                typeof content !== 'object' ||
                Array.isArray(content) ||
                !Object.prototype.hasOwnProperty.call(content, 'content')
              )
                throw new Error();
            } catch {
              throw new Error(
                'Historical Discussion payload has invalid UTF-8 or content'
              );
            }
            if (item.decision.kind === 'adopt') {
              await this.repository.adopt(item, {
                key: item.key,
                sha256: hash(snapshot.body),
                bytes: snapshot.body.length,
              });
            } else {
              const reference = copiedReference(item, snapshot.body);
              await this.repository.prepareCopy(item, reference);
              await this.objects.copy(reference, snapshot.body);
              await this.repository.confirmCopy(item, reference);
              await this.repository.retire(
                item,
                () => this.objects.retire(item),
                reference
              );
            }
          }
        } else if (item.decision.kind !== 'tracked') {
          await this.repository.retire(item, () => this.objects.retire(item));
        }
        progress = await this.repository.advance(progress, item.key);
      }
      return this.repository.finish(progress, fingerprint, !plan.more);
    });
  }
}
