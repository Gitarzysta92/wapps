import { mentionNotificationJournalRow } from './mysql-mention-notifications';
import type { DataSource } from 'typeorm';
import {
  DISCUSSION_MAX_DEPTH,
  DISCUSSION_MAX_NODES,
  DISCUSSION_MAX_PAYLOAD_BYTES,
} from '@apps/shared';
import {
  readonlyMysqlSnapshot,
  type MysqlSnapshotReader,
} from '@sdk/extras/mysql';
import {
  AccountExportCaptureSequence,
  AccountExportSourceInvalid,
  CanonicalIdentityAccessDenied,
  isCanonicalIdentityId,
  type AccountExportEntry,
} from '@sdk/features/identity/core';
import type { AccountExportSource } from '@sdk/features/identity/libs/management';
import { publicCommentId, replyNotificationEvent } from '@domains/community';
import { reviewContent, reviewText } from '@sdk/features/review/core';
import type { DiscussionExportPayloads } from '../application/discussion-export-payloads.port';
import {
  assertExportPayloadRegistration,
  discussionExportRegistrations,
} from './discussion-export-registrations';

type Row = Record<string, unknown>;
function invalid(): never {
  throw new AccountExportSourceInvalid(
    'Invalid canonical discussion export data'
  );
}
function decode<T>(read: () => T): T {
  try {
    return read();
  } catch {
    return invalid();
  }
}
function integer(value: unknown, minimum = 0): number {
  const number =
    typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;
  if (
    typeof number !== 'number' ||
    !Number.isSafeInteger(number) ||
    number < minimum
  )
    return invalid();
  return number;
}
function nullableInteger(value: unknown): number | null {
  return value === null ? null : integer(value);
}
function id(value: unknown): string {
  return decode(() => publicCommentId(value));
}
function scope(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 128 ||
    value !== value.trim()
  )
    return invalid();
  return value;
}
function flag(value: unknown): boolean {
  const number = integer(value);
  if (number > 1) return invalid();
  return number === 1;
}
function choice<T extends string>(value: unknown, allowed: readonly T[]): T {
  for (const candidate of allowed) if (value === candidate) return candidate;
  return invalid();
}

interface Structure {
  tenantId: string;
  discussionId: string;
  revision: number;
  subjectId: string | null;
  subjectKind: 'article' | 'application' | null;
  pinned: boolean;
  parents: Map<string, string>;
}

async function structure(
  reader: MysqlSnapshotReader,
  discussionId: string
): Promise<Structure> {
  const [aggregate] = await reader.query(
    'SELECT id, tenantId, revision, subjectId, subjectKind, pinned FROM discussion_write_aggregates WHERE id = ?',
    [discussionId]
  );
  if (!aggregate || aggregate.id !== discussionId) return invalid();
  const subjectId =
    aggregate.subjectId === null ? null : id(aggregate.subjectId);
  const subjectKind =
    aggregate.subjectKind === null
      ? null
      : choice(aggregate.subjectKind, ['article', 'application']);
  const pinned = flag(aggregate.pinned);
  if (
    (subjectKind !== null && subjectId === null) ||
    (pinned && subjectKind !== 'application')
  )
    return invalid();
  const nodes = await reader.query(
    `SELECT m.nodeId AS id, n.id AS foundId, n.kind FROM discussion_write_nodes m
     LEFT JOIN content_nodes n ON n.id = m.nodeId WHERE m.discussionId = ? ORDER BY m.nodeId LIMIT ${
       DISCUSSION_MAX_NODES + 1
     }`,
    [discussionId]
  );
  if (!nodes.length || nodes.length > DISCUSSION_MAX_NODES) return invalid();
  const ids = new Set<string>();
  for (const node of nodes) {
    const nodeId = id(node.id);
    if (
      node.foundId !== nodeId ||
      node.kind !== (nodeId === discussionId ? 'discussion' : 'comment') ||
      ids.has(nodeId)
    )
      return invalid();
    ids.add(nodeId);
  }
  if (!ids.has(discussionId)) return invalid();
  const relations = await reader.query(
    `SELECT r.fromContentId, r.toContentId, r.relationType FROM content_node_relations r
     JOIN discussion_write_nodes m ON m.nodeId = r.fromContentId
     WHERE m.discussionId = ? AND r.relationType IN ('replies', 'discusses') LIMIT ${
       DISCUSSION_MAX_NODES * 2 + 1
     }`,
    [discussionId]
  );
  if (relations.length > DISCUSSION_MAX_NODES * 2) return invalid();
  const parents = new Map<string, string>();
  let subjects = 0;
  for (const relation of relations) {
    const from = id(relation.fromContentId),
      to = id(relation.toContentId);
    if (!ids.has(from)) return invalid();
    if (relation.relationType === 'discusses') {
      if (++subjects > 1 || from !== discussionId || to !== subjectId)
        return invalid();
    } else {
      if (from === discussionId || !ids.has(to) || parents.has(from))
        return invalid();
      parents.set(from, to);
    }
  }
  if (subjects !== (subjectId === null ? 0 : 1)) return invalid();
  for (const nodeId of ids) {
    let current = nodeId;
    const visited = new Set<string>();
    while (current !== discussionId) {
      if (visited.has(current) || visited.size >= DISCUSSION_MAX_DEPTH)
        return invalid();
      visited.add(current);
      const parent = parents.get(current);
      if (!parent) return invalid();
      current = parent;
    }
  }
  return {
    tenantId: scope(aggregate.tenantId),
    discussionId,
    revision: integer(aggregate.revision, 1),
    subjectId,
    subjectKind,
    pinned,
    parents,
  };
}

/** Private owner capture spans tenants; it never includes another author's payload or a projection. */
export class MysqlDiscussionAccountExportSource implements AccountExportSource {
  readonly name = 'discussion';
  constructor(
    private readonly source: DataSource,
    private readonly payloads: DiscussionExportPayloads,
    private readonly now = Date.now
  ) {}

  async *capture(
    identityId: string,
    signal: AbortSignal
  ): AsyncIterable<AccountExportEntry> {
    if (!isCanonicalIdentityId(identityId))
      throw new CanonicalIdentityAccessDenied('Authentication required');
    const sequence = new AccountExportCaptureSequence(this.name);
    let records = 0;
    const entry = (collection: string, data: unknown) => {
      const result = sequence.accept({
        type: 'record',
        source: this.name,
        collection,
        data,
      });
      records++;
      return result;
    };
    const payloads = this.payloads,
      startedAt = this.now();
    yield* readonlyMysqlSnapshot(this.source, signal, async function* (reader) {
      // A consistent read establishes the SQL snapshot before the begin receipt is exposed.
      await reader.query(
        'SELECT nodeId FROM discussion_write_nodes WHERE ownerIdentityId = ? LIMIT 1',
        [identityId]
      );
      yield sequence.accept({
        type: 'begin',
        source: 'discussion',
        at: startedAt,
      });
      let after = '';
      for (;;) {
        const groups: Row[] = await reader.query(
          `SELECT DISTINCT discussionId AS id FROM discussion_write_nodes
           WHERE ownerIdentityId = ? AND discussionId > ? ORDER BY discussionId LIMIT 128`,
          [identityId, after]
        );
        for (const group of groups) {
          const discussionId = id(group.id);
          const context = await structure(reader, discussionId);
          const nodes = await reader.query(
            `SELECT m.nodeId AS id, m.ownerIdentityId, m.payloadKey, m.payloadHash, m.payloadBytes,
             n.referenceKey, n.kind, n.state, n.visibility, n.createdAt, n.updatedAt, n.deletedAt
             FROM discussion_write_nodes m LEFT JOIN content_nodes n ON n.id = m.nodeId
             WHERE m.ownerIdentityId = ? AND m.discussionId = ? ORDER BY m.nodeId LIMIT ${
               DISCUSSION_MAX_NODES + 1
             }`,
            [identityId, discussionId]
          );
          if (!nodes.length || nodes.length > DISCUSSION_MAX_NODES)
            return invalid();
          for (const node of nodes) {
            if (node.ownerIdentityId !== identityId) return invalid();
            const nodeId = id(node.id),
              deletedAt = nullableInteger(node.deletedAt),
              createdAt = integer(node.createdAt),
              updatedAt = nullableInteger(node.updatedAt);
            if (
              (updatedAt !== null && updatedAt < createdAt) ||
              (deletedAt !== null &&
                (deletedAt < createdAt ||
                  updatedAt === null ||
                  updatedAt < deletedAt))
            )
              return invalid();
            const kind = choice(node.kind, ['discussion', 'comment']);
            const parentId = context.parents.get(nodeId) ?? null;
            if (
              (nodeId === discussionId) !== (kind === 'discussion') ||
              (kind === 'comment' && parentId === null)
            )
              return invalid();
            let content: unknown = null;
            if (deletedAt === null) {
              const bytes = integer(node.payloadBytes, 1);
              if (
                typeof node.payloadKey !== 'string' ||
                typeof node.payloadHash !== 'string' ||
                bytes > DISCUSSION_MAX_PAYLOAD_BYTES
              )
                return invalid();
              const reference = {
                key: node.payloadKey,
                sha256: node.payloadHash,
                bytes,
              };
              await assertExportPayloadRegistration(
                reader,
                identityId,
                context.tenantId,
                nodeId,
                reference
              );
              content = await payloads.read(nodeId, reference, signal);
            } else if (
              node.payloadKey !== null ||
              node.payloadHash !== null ||
              node.payloadBytes !== null
            )
              return invalid();
            yield entry('contributions', {
              id: nodeId,
              referenceKey: id(node.referenceKey),
              tenantId: context.tenantId,
              discussionId,
              discussionRevision: context.revision,
              parentId,
              subjectId: context.subjectId,
              subjectKind: context.subjectKind,
              pinned: context.pinned,
              kind,
              state: choice(node.state, ['draft', 'published', 'archived']),
              visibility: choice(node.visibility, [
                'public',
                'unlisted',
                'private',
              ]),
              createdAt,
              updatedAt,
              deletedAt,
              content,
            });
          }
          after = discussionId;
        }
        if (groups.length < 128) break;
      }
      for await (const record of discussionExportRegistrations(
        reader,
        identityId,
        payloads,
        signal
      ))
        yield entry(record.collection, record.data);
      for (const table of ['comment_likes', 'discussion_votes'] as const) {
        const column = table === 'comment_likes' ? 'commentId' : 'nodeId';
        let after = '';
        for (;;) {
          const rows: Row[] = await reader.query(
            `SELECT v.${column} AS nodeId, v.actorIdentityId, v.createdAt,
             ${table === 'discussion_votes' ? 'v.value, v.updatedAt,' : ''}
             m.discussionId, a.tenantId, a.subjectId, a.subjectKind, n.id AS foundId
             FROM ${table} v LEFT JOIN discussion_write_nodes m ON m.nodeId = v.${column}
             LEFT JOIN discussion_write_aggregates a ON a.id = m.discussionId
             LEFT JOIN content_nodes n ON n.id = m.nodeId
             WHERE v.actorIdentityId = ? AND v.${column} > ? ORDER BY v.${column} LIMIT 128`,
            [identityId, after]
          );
          for (const row of rows) {
            if (
              row.actorIdentityId !== identityId ||
              row.foundId !== row.nodeId
            )
              return invalid();
            const createdAt = integer(row.createdAt);
            const subjectKind =
              row.subjectKind === null
                ? null
                : choice(row.subjectKind, ['article', 'application']);
            const subjectId = row.subjectId === null ? null : id(row.subjectId);
            if (subjectKind !== null && subjectId === null) return invalid();
            const value = table === 'discussion_votes' ? row.value : null;
            const updatedAt =
              table === 'discussion_votes' ? integer(row.updatedAt) : null;
            if (
              table === 'discussion_votes' &&
              ((value !== -1 && value !== 1) ||
                subjectKind !== 'application' ||
                updatedAt === null ||
                updatedAt < createdAt)
            )
              return invalid();
            yield entry(table === 'comment_likes' ? 'likes' : 'votes', {
              nodeId: id(row.nodeId),
              discussionId: id(row.discussionId),
              tenantId: scope(row.tenantId),
              subjectId,
              subjectKind,
              createdAt,
              ...(table === 'discussion_votes' ? { value, updatedAt } : {}),
            });
            after = id(row.nodeId);
          }
          if (rows.length < 128) break;
        }
      }
      let notificationAfter = '';
      for (;;) {
        const rows: Row[] = await reader.query(
          'SELECT id,recipientId,discussionId,parentId,revision,createdAt,attempts,deliveredAt,failedAt FROM discussion_reply_notifications WHERE recipientId=? AND id>? ORDER BY id LIMIT 128',
          [identityId, notificationAfter]
        );
        for (const row of rows) {
          const event = decode(() =>
            replyNotificationEvent({
              id: row.id,
              recipientId: row.recipientId,
              discussionId: row.discussionId,
              parentId: row.parentId,
              revision: integer(row.revision, 2),
              at: integer(row.createdAt),
            })
          );
          const attempts = integer(row.attempts),
            deliveredAt = nullableInteger(row.deliveredAt),
            failedAt = nullableInteger(row.failedAt);
          if (
            event.recipientId !== identityId ||
            attempts > 12 ||
            (deliveredAt !== null && failedAt !== null)
          )
            return invalid();
          yield entry('reply-notifications', {
            event,
            attempts,
            deliveredAt,
            failedAt,
          });
          notificationAfter = event.id;
        }
        if (rows.length < 128) break;
      }
      let mentionAfter = '';
      for (;;) {
        const rows: Row[] = await reader.query(
          'SELECT * FROM discussion_mention_notifications WHERE recipientId=? AND id>? ORDER BY id LIMIT 128',
          [identityId, mentionAfter]
        );
        for (const row of rows) {
          const value = decode(() => mentionNotificationJournalRow(row));
          if (value.event.recipientId !== identityId) return invalid();
          yield entry('mention-notifications', {
            event: value.event,
            profileId: value.profileId,
            active: value.active,
            attempts: value.attempts,
            deliveredAt: value.deliveredAt,
            failedAt: value.failedAt,
          });
          mentionAfter = value.event.id;
        }
        if (rows.length < 128) break;
      }
      let reviewAfter = '';
      for (;;) {
        const reviews: Row[] = await reader.query(
          `SELECT id, ownerId, tenantId, applicationId, revision, contentRevision, withdrawn, hidden,
           moderationReason, createdAt, updatedAt FROM member_reviews
           WHERE ownerId = ? AND id > ? ORDER BY id LIMIT 128`,
          [identityId, reviewAfter]
        );
        for (const row of reviews) {
          if (row.ownerId !== identityId) return invalid();
          const reviewId = id(row.id),
            revision = integer(row.revision, 1),
            contentRevision = integer(row.contentRevision, 1);
          const createdAt = integer(row.createdAt, 1),
            updatedAt = integer(row.updatedAt, 1);
          if (contentRevision > revision || updatedAt < createdAt)
            return invalid();
          yield entry('reviews', {
            id: reviewId,
            tenantId: scope(row.tenantId),
            applicationId: id(row.applicationId),
            revision,
            contentRevision,
            withdrawn: flag(row.withdrawn),
            hidden: flag(row.hidden),
            createdAt,
            updatedAt,
            moderationReason:
              row.moderationReason === null
                ? null
                : decode(() =>
                    reviewText(row.moderationReason, 'Moderation reason', 1000)
                  ),
          });
          let version = 0,
            found = false;
          for (;;) {
            const versions: Row[] = await reader.query(
              'SELECT revision, displayName, rating, text FROM review_versions WHERE reviewId = ? AND revision > ? ORDER BY revision LIMIT 128',
              [reviewId, version]
            );
            for (const retained of versions) {
              const next = integer(retained.revision, 1);
              if (next <= version || next > contentRevision) return invalid();
              const content = decode(() =>
                reviewContent({
                  displayName: retained.displayName,
                  rating: integer(retained.rating, 1),
                  text: retained.text,
                })
              );
              yield entry('review-versions', {
                reviewId,
                revision: next,
                content,
              });
              if (next === contentRevision) found = true;
              version = next;
            }
            if (versions.length < 128) break;
          }
          if (!found) return invalid();
          reviewAfter = reviewId;
        }
        if (reviews.length < 128) break;
      }
      for (const table of ['review_helpful', 'review_reports'] as const) {
        const column = table === 'review_helpful' ? 'reviewId' : 'id';
        let after = '';
        for (;;) {
          const rows: Row[] = await reader.query(
            `SELECT p.${column} AS cursorId, p.reviewId, p.actorId, p.createdAt,
             ${
               table === 'review_reports'
                 ? 'p.contentRevision, p.reason, p.resolution, p.resolvedAt,'
                 : ''
             }
             r.id AS foundId, r.tenantId, r.applicationId FROM ${table} p
             LEFT JOIN member_reviews r ON r.id = p.reviewId
             WHERE p.actorId = ? AND p.${column} > ? ORDER BY p.${column} LIMIT 128`,
            [identityId, after]
          );
          for (const row of rows) {
            if (row.actorId !== identityId || row.foundId !== row.reviewId)
              return invalid();
            const shared = {
              reviewId: id(row.reviewId),
              tenantId: scope(row.tenantId),
              applicationId: id(row.applicationId),
              createdAt: integer(row.createdAt, 1),
            };
            if (table === 'review_reports') {
              const resolution = choice(row.resolution, [
                'open',
                'dismissed',
                'hidden',
              ]);
              const resolvedAt = nullableInteger(row.resolvedAt);
              if (
                (resolution === 'open') !== (resolvedAt === null) ||
                (resolvedAt !== null && resolvedAt < shared.createdAt)
              )
                return invalid();
              yield entry('review-reports', {
                ...shared,
                id: id(row.cursorId),
                contentRevision: integer(row.contentRevision, 1),
                reason: decode(() =>
                  reviewText(row.reason, 'Report reason', 1000)
                ),
                resolution,
                resolvedAt,
              });
            } else yield entry('review-helpful', shared);
            after = id(row.cursorId);
          }
          if (rows.length < 128) break;
        }
      }
    });
    signal.throwIfAborted();
    yield sequence.accept({
      type: 'end',
      source: this.name,
      at: this.now(),
      records,
    });
  }
}
