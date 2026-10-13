import { advanceContentUpdateCursor } from '@sdk/extras/mysql';
import {
  lockIdentityWrites,
  lockIdentityWriteRecipients,
} from '@sdk/extras/identity-mysql';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { publicCommentId } from '@sdk/features/discussion/core';
import { commitDiscussionPayload } from './mysql-discussion-payloads';
import {
  commitDiscussionMentions,
  preparedMentionRecipients,
} from './mysql-discussion-mentions';
import {
  DISCUSSION_MAX_DEPTH,
  DISCUSSION_MAX_GENERATION_BYTES,
  DISCUSSION_MAX_NODES,
} from '@apps/shared';
import {
  DiscussionCommandIdentity,
  DiscussionCommit,
  DiscussionConflictError,
  DiscussionNotFoundError,
  DiscussionResource,
  DiscussionValidationError,
  DiscussionWriteRepository,
  PreparedDiscussionMutation,
} from '../application/discussion-write.port';

type NumberField = string | number;
type ResourceRow = Omit<
  DiscussionResource,
  'revision' | 'deletedAt' | 'rootDeletedAt' | 'pinned'
> & {
  pinned: NumberField;
  subjectKind: string | null;
  subjectId: string | null;
  revision: NumberField;
  deletedAt: NumberField | null;
  rootDeletedAt: NumberField | null;
};

export function safeSqlInteger(value: NumberField): number {
  const result =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof result !== 'number' || !Number.isSafeInteger(result) || result < 0)
    throw new Error('Invalid authoritative numeric value');
  return result;
}

const resourceSql = `SELECT n.id, n.kind, n.state, n.visibility, n.deletedAt,
  m.discussionId, m.ownerIdentityId, a.tenantId, a.revision,
  root.state rootState, root.visibility rootVisibility, root.deletedAt rootDeletedAt,
  owner.ownerIdentityId rootOwnerIdentityId, a.subjectId, a.subjectKind, a.pinned
  FROM discussion_write_nodes m
  JOIN content_nodes n ON n.id = m.nodeId
  JOIN discussion_write_aggregates a ON a.id = m.discussionId
  JOIN content_nodes root ON root.id = a.id
  JOIN discussion_write_nodes owner ON owner.nodeId = a.id`;

@Injectable()
export class MysqlDiscussionWrites implements DiscussionWriteRepository {
  constructor(private readonly db: DataSource) {}

  async resource(id: string): Promise<DiscussionResource | null> {
    return this.readResource(this.db.manager, id);
  }

  async resources(discussionId: string): Promise<DiscussionResource[]> {
    const rows = await this.db.query<ResourceRow[]>(
      `${resourceSql} WHERE a.id = ? LIMIT ?`,
      [discussionId, DISCUSSION_MAX_NODES + 1]
    );
    if (rows.length > DISCUSSION_MAX_NODES)
      throw new Error('Discussion exceeds node limit');
    return rows.map((row) => this.mapResource(row));
  }

  async receipt(
    command: DiscussionCommandIdentity
  ): Promise<DiscussionCommit | null> {
    return this.db.transaction('READ COMMITTED', async (manager) => {
      await lockIdentityWrites(manager, [command.actor.identityId]);
      return this.readReceipt(manager, command);
    });
  }

  async commit(
    mutation: PreparedDiscussionMutation
  ): Promise<DiscussionCommit> {
    try {
      return await this.db.transaction('READ COMMITTED', async (tx) => {
        if (
          mutation.type === 'update' &&
          mutation.resource.ownerIdentityId === null
        )
          throw new DiscussionConflictError(
            'An anonymized contribution cannot acquire a new owner'
          );
        const notificationRecipients = await lockIdentityWriteRecipients(
          tx,
          [
            mutation.command.actor.identityId,
            ...(mutation.type === 'update' &&
            mutation.resource.ownerIdentityId !== null
              ? [mutation.resource.ownerIdentityId]
              : []),
          ],
          [
            ...preparedMentionRecipients(mutation).map((row) => row.identityId),
            ...(mutation.type === 'reply' &&
            mutation.resource.ownerIdentityId !== null
              ? [mutation.resource.ownerIdentityId]
              : []),
          ]
        );
        const replay = await this.readReceipt(tx, mutation.command);
        if (replay) return replay;
        const discussionId =
          mutation.type === 'create'
            ? mutation.nodeId
            : mutation.resource.discussionId;
        let revision = 1;
        let changed = true;
        if (mutation.type === 'create') {
          if (
            mutation.target &&
            (!['article', 'application'].includes(mutation.target.kind) ||
              mutation.subjectId !== publicCommentId(mutation.target.id) ||
              mutation.state !== 'published' ||
              mutation.visibility !== 'public')
          )
            throw new DiscussionValidationError('Invalid article target');
          await tx.query(
            `INSERT INTO discussion_write_aggregates (id, tenantId, revision, subjectId, subjectKind, createdAt) VALUES (?, ?, 1, ?, ?, ?)`,
            [
              discussionId,
              mutation.command.actor.tenantId,
              mutation.subjectId,
              mutation.target?.kind ?? null,
              mutation.at,
            ]
          );
          await this.insertNode(
            tx,
            mutation,
            discussionId,
            'discussion',
            null,
            mutation.state,
            mutation.visibility
          );
          if (mutation.subjectId)
            await this.insertRelation(
              tx,
              mutation.nodeId,
              mutation.subjectId,
              'discusses',
              mutation.at
            );
        } else {
          const aggregates = await tx.query<Array<{ revision: NumberField }>>(
            `SELECT revision FROM discussion_write_aggregates WHERE id = ? FOR UPDATE`,
            [discussionId]
          );
          if (!aggregates.length)
            throw new DiscussionNotFoundError('Discussion not found');
          const concurrentReplay = await this.readReceipt(tx, mutation.command);
          if (concurrentReplay) return concurrentReplay;
          const current = await this.readResource(tx, mutation.resource.id);
          if (
            !current ||
            JSON.stringify(current) !== JSON.stringify(mutation.resource)
          ) {
            throw new DiscussionConflictError(
              'Discussion changed during authorization; retry after reload'
            );
          }
          revision = safeSqlInteger(aggregates[0].revision);
          if (revision >= Number.MAX_SAFE_INTEGER)
            throw new DiscussionConflictError(
              'Aggregate revision limit reached'
            );
          switch (mutation.type) {
            case 'pin':
              if (
                current.target?.kind !== 'application' ||
                current.id !== discussionId ||
                current.kind !== 'discussion' ||
                typeof mutation.pinned !== 'boolean'
              )
                throw new DiscussionValidationError(
                  'Invalid application topic pin'
                );
              await tx.query(
                'UPDATE discussion_write_aggregates SET pinned = ? WHERE id = ?',
                [mutation.pinned ? 1 : 0, discussionId]
              );
              break;
            case 'vote':
              if (
                current.target?.kind !== 'application' ||
                ![-1, 0, 1].includes(mutation.value)
              )
                throw new DiscussionValidationError(
                  'Invalid application discussion vote'
                );
              if (mutation.value === 0) {
                await tx.query(
                  'DELETE FROM discussion_votes WHERE nodeId = ? AND actorIdentityId = ?',
                  [mutation.nodeId, mutation.command.actor.identityId]
                );
              } else {
                await tx.query(
                  `INSERT INTO discussion_votes (nodeId, actorIdentityId, value, createdAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updatedAt = GREATEST(updatedAt, VALUES(updatedAt))`,
                  [
                    mutation.nodeId,
                    mutation.command.actor.identityId,
                    mutation.value,
                    mutation.at,
                    mutation.at,
                  ]
                );
              }
              break;
            case 'reply':
              await this.checkCapacity(
                tx,
                discussionId,
                mutation.payload.bytes,
                true
              );
              await this.checkReplyDepth(
                tx,
                mutation.resource.id,
                discussionId
              );
              await this.insertNode(
                tx,
                mutation,
                discussionId,
                'comment',
                mutation.resource.id,
                'published',
                mutation.resource.visibility
              );
              break;
            case 'update': {
              const previous = await tx.query<
                Array<{ payloadBytes: NumberField | null }>
              >(
                'SELECT payloadBytes FROM discussion_write_nodes WHERE nodeId = ?',
                [mutation.nodeId]
              );
              await this.checkCapacity(
                tx,
                discussionId,
                mutation.payload.bytes -
                  safeSqlInteger(previous[0]?.payloadBytes ?? 0),
                false
              );
              await tx.query(
                'UPDATE content_nodes SET state = ?, visibility = ?, updatedAt = ? WHERE id = ?',
                [
                  mutation.state,
                  mutation.visibility,
                  mutation.at,
                  mutation.nodeId,
                ]
              );
              await tx.query(
                'UPDATE discussion_write_nodes SET payloadKey = ?, payloadHash = ?, payloadBytes = ? WHERE nodeId = ?',
                [
                  mutation.payload.key,
                  mutation.payload.sha256,
                  mutation.payload.bytes,
                  mutation.nodeId,
                ]
              );
              break;
            }
            case 'delete':
              await tx.query(
                'UPDATE content_nodes SET deletedAt = ?, updatedAt = ? WHERE id = ?',
                [mutation.at, mutation.at, mutation.nodeId]
              );
              await tx.query(
                'UPDATE discussion_write_nodes SET payloadKey = NULL, payloadHash = NULL, payloadBytes = NULL WHERE nodeId = ?',
                [mutation.nodeId]
              );
              break;
            case 'like':
            case 'unlike': {
              const likes = await tx.query<Array<{ id: string }>>(
                'SELECT id FROM comment_likes WHERE commentId = ? AND actorIdentityId = ?',
                [mutation.nodeId, mutation.command.actor.identityId]
              );
              if (mutation.type === 'like' && !likes.length) {
                await tx.query(
                  'INSERT INTO comment_likes (id, commentId, actorIdentityId, createdAt) VALUES (?, ?, ?, ?)',
                  [
                    randomUUID(),
                    mutation.nodeId,
                    mutation.command.actor.identityId,
                    mutation.at,
                  ]
                );
              } else if (mutation.type === 'unlike' && likes.length) {
                await tx.query(
                  'DELETE FROM comment_likes WHERE commentId = ? AND actorIdentityId = ?',
                  [mutation.nodeId, mutation.command.actor.identityId]
                );
              } else changed = false;
              if (changed)
                await tx.query(
                  'UPDATE content_nodes SET updatedAt = ? WHERE id = ?',
                  [mutation.at, mutation.nodeId]
                );
              break;
            }
          }
          if (changed) {
            revision++;
            await tx.query(
              'UPDATE discussion_write_aggregates SET revision = ? WHERE id = ?',
              [revision, discussionId]
            );
          }
        }
        if ('payload' in mutation) {
          const ownerIdentityId =
            mutation.type === 'update'
              ? mutation.resource.ownerIdentityId
              : mutation.command.actor.identityId;
          if (ownerIdentityId === null)
            throw new DiscussionConflictError('Missing payload owner');
          await commitDiscussionPayload(tx, mutation.nodeId, mutation.payload, {
            tenantId: mutation.command.actor.tenantId,
            actorIdentityId: mutation.command.actor.identityId,
            ownerIdentityId,
          });
        }
        if (changed) {
          await tx.query(
            'INSERT INTO discussion_outbox (id, discussionId, revision, createdAt, availableAt) VALUES (?, ?, ?, ?, ?)',
            [randomUUID(), discussionId, revision, mutation.at, mutation.at]
          );
        }
        let publiclyVisible = false;
        if (
          changed &&
          (mutation.type === 'create' ||
            mutation.type === 'reply' ||
            mutation.type === 'update')
        ) {
          const node = await this.readResource(tx, mutation.nodeId);
          if (
            node?.target &&
            node.deletedAt === null &&
            node.rootDeletedAt === null &&
            node.state === 'published' &&
            node.visibility === 'public' &&
            node.rootState === 'published' &&
            node.rootVisibility === 'public'
          ) {
            publiclyVisible = true;
            await advanceContentUpdateCursor(
              tx,
              'discussions',
              discussionId,
              mutation.at
            );
          }
        }
        await commitDiscussionMentions(
          tx,
          mutation,
          discussionId,
          revision,
          notificationRecipients,
          publiclyVisible
        );
        if (
          mutation.type === 'reply' &&
          mutation.resource.target &&
          mutation.resource.ownerIdentityId !==
            mutation.command.actor.identityId &&
          mutation.resource.ownerIdentityId !== null &&
          notificationRecipients.includes(mutation.resource.ownerIdentityId) &&
          mutation.resource.state === 'published' &&
          mutation.resource.visibility === 'public' &&
          mutation.resource.rootState === 'published' &&
          mutation.resource.rootVisibility === 'public'
        ) {
          await tx.query(
            'INSERT INTO discussion_reply_notifications (id,recipientId,discussionId,parentId,revision,createdAt,availableAt) VALUES (?,?,?,?,?,?,?)',
            [
              mutation.nodeId,
              mutation.resource.ownerIdentityId,
              discussionId,
              mutation.resource.id,
              revision,
              mutation.at,
              mutation.at,
            ]
          );
        }
        await tx.query(
          `INSERT INTO discussion_commands (tenantId, actorIdentityId, commandKey, fingerprint, nodeId, discussionId, revision, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mutation.command.actor.tenantId,
            mutation.command.actor.identityId,
            mutation.command.key,
            mutation.command.fingerprint,
            mutation.nodeId,
            discussionId,
            revision,
            mutation.at,
          ]
        );
        return {
          id: mutation.nodeId,
          discussionId,
          revision,
          projection: 'pending',
        };
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        const replay = await this.receipt(mutation.command);
        if (replay) return replay;
      }
      throw error;
    }
  }

  private async readResource(
    tx: EntityManager,
    id: string
  ): Promise<DiscussionResource | null> {
    const rows = await tx.query<ResourceRow[]>(
      `${resourceSql} WHERE n.id = ?`,
      [id]
    );
    return rows.length ? this.mapResource(rows[0]) : null;
  }

  private mapResource(row: ResourceRow): DiscussionResource {
    const { subjectKind, subjectId, pinned, ...resource } = row;
    const pinState = safeSqlInteger(pinned);
    if (pinState > 1 || (pinState === 1 && subjectKind !== 'application'))
      throw new Error('Invalid canonical discussion pin state');
    if (
      subjectKind !== null &&
      subjectKind !== 'article' &&
      subjectKind !== 'application'
    )
      throw new Error('Inconsistent discussion target');
    return {
      ...resource,
      pinned: pinState === 1,
      target:
        subjectKind === null
          ? null
          : { kind: subjectKind, id: publicCommentId(subjectId) },
      revision: safeSqlInteger(row.revision),
      deletedAt: row.deletedAt === null ? null : safeSqlInteger(row.deletedAt),
      rootDeletedAt:
        row.rootDeletedAt === null ? null : safeSqlInteger(row.rootDeletedAt),
    };
  }

  private async readReceipt(
    tx: EntityManager,
    command: DiscussionCommandIdentity
  ): Promise<DiscussionCommit | null> {
    const rows = await tx.query<
      Array<{
        fingerprint: string;
        nodeId: string;
        discussionId: string;
        revision: NumberField;
      }>
    >(
      'SELECT fingerprint, nodeId, discussionId, revision FROM discussion_commands WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
      [command.actor.tenantId, command.actor.identityId, command.key]
    );
    if (!rows.length) return null;
    if (rows[0].fingerprint !== command.fingerprint)
      throw new DiscussionConflictError(
        'Idempotency-Key was already used for a different command'
      );
    return {
      id: rows[0].nodeId,
      discussionId: rows[0].discussionId,
      revision: safeSqlInteger(rows[0].revision),
      projection: 'pending',
    };
  }

  private async insertNode(
    tx: EntityManager,
    mutation: Extract<PreparedDiscussionMutation, { type: 'create' | 'reply' }>,
    discussionId: string,
    kind: string,
    parentId: string | null,
    state: string,
    visibility: string
  ) {
    await tx.query(
      `INSERT INTO content_nodes (id, referenceKey, kind, state, visibility, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        mutation.nodeId,
        mutation.referenceKey,
        kind,
        state,
        visibility,
        mutation.at,
      ]
    );
    await tx.query(
      `INSERT INTO discussion_write_nodes (nodeId, discussionId, ownerIdentityId, payloadKey, payloadHash, payloadBytes) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        mutation.nodeId,
        discussionId,
        mutation.command.actor.identityId,
        mutation.payload.key,
        mutation.payload.sha256,
        mutation.payload.bytes,
      ]
    );
    if (parentId)
      await this.insertRelation(
        tx,
        mutation.nodeId,
        parentId,
        'replies',
        mutation.at
      );
  }

  private async insertRelation(
    tx: EntityManager,
    from: string,
    to: string,
    type: string,
    at: number
  ) {
    await tx.query(
      `INSERT INTO content_node_relations (id, fromContentId, toContentId, relationType, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), from, to, type, at]
    );
  }

  private async checkCapacity(
    tx: EntityManager,
    discussionId: string,
    additionalBytes: number,
    newNode: boolean
  ) {
    const rows = await tx.query<
      Array<{ count: NumberField; bytes: NumberField }>
    >(
      `SELECT COUNT(*) count, COALESCE(SUM(payloadBytes), 0) bytes FROM discussion_write_nodes WHERE discussionId = ?`,
      [discussionId]
    );
    if (
      (newNode && safeSqlInteger(rows[0].count) >= DISCUSSION_MAX_NODES) ||
      safeSqlInteger(rows[0].bytes) + additionalBytes >
        DISCUSSION_MAX_GENERATION_BYTES
    ) {
      throw new DiscussionValidationError('Discussion size limit reached');
    }
  }

  private async checkReplyDepth(
    tx: EntityManager,
    parentId: string,
    discussionId: string
  ) {
    const seen = new Set<string>();
    let current = parentId;
    for (let depth = 1; depth <= DISCUSSION_MAX_DEPTH; depth++) {
      if (current === discussionId) return;
      if (seen.has(current))
        throw new DiscussionConflictError('Corrupt discussion ancestry');
      seen.add(current);
      const rows = await tx.query<Array<{ toContentId: string }>>(
        `SELECT r.toContentId FROM content_node_relations r
        JOIN discussion_write_nodes m ON m.nodeId = r.toContentId AND m.discussionId = ?
        WHERE r.fromContentId = ? AND r.relationType = 'replies' LIMIT 2`,
        [discussionId, current]
      );
      if (rows.length !== 1)
        throw new DiscussionConflictError(
          'Missing or ambiguous discussion parent'
        );
      current = rows[0].toContentId;
    }
    throw new DiscussionValidationError('Reply depth limit reached');
  }
}
