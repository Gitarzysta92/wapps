import type { DiscussionPayloadReference } from '@apps/shared';
import type { MysqlSnapshotReader } from '@sdk/extras/mysql';
import { AccountExportSourceInvalid } from '@sdk/features/identity/core';
import type { DiscussionExportPayloads } from '../application/discussion-export-payloads.port';
import {
  registeredDiscussionPayload,
  type RegisteredDiscussionPayload,
} from './mysql-discussion-payloads';

function invalid(): never {
  throw new AccountExportSourceInvalid(
    'Invalid canonical discussion payload registration'
  );
}

function registration(
  row: Record<string, unknown>
): RegisteredDiscussionPayload {
  try {
    return registeredDiscussionPayload(row);
  } catch {
    return invalid();
  }
}

export async function assertExportPayloadRegistration(
  reader: MysqlSnapshotReader,
  ownerIdentityId: string,
  tenantId: string,
  nodeId: string,
  reference: DiscussionPayloadReference
): Promise<void> {
  const [row] = await reader.query(
    'SELECT * FROM discussion_payload_objects WHERE objectKey = ?',
    [reference.key]
  );
  if (!row) return invalid();
  const stored = registration(row);
  if (
    stored.nodeId !== nodeId ||
    stored.ownerIdentityId !== ownerIdentityId ||
    stored.tenantId !== tenantId ||
    stored.state !== 'committed' ||
    stored.reference.sha256 !== reference.sha256 ||
    stored.reference.bytes !== reference.bytes
  )
    return invalid();
}

/** Owner bytes and uploader-only action metadata share the source's existing SQL snapshot. */
export async function* discussionExportRegistrations(
  reader: MysqlSnapshotReader,
  identityId: string,
  payloads: DiscussionExportPayloads,
  signal: AbortSignal
): AsyncIterable<{ collection: string; data: unknown }> {
  for (const owned of [true, false]) {
    let after = '';
    for (;;) {
      const rows = await reader.query(
        `SELECT o.* ${
          owned
            ? `, n.nodeId AS referenceNodeId, n.ownerIdentityId AS referenceOwnerId,
         n.payloadHash AS referenceHash, n.payloadBytes AS referenceBytes, a.tenantId AS referenceTenantId`
            : ''
        }
         FROM discussion_payload_objects o
         ${
           owned
             ? `LEFT JOIN discussion_write_nodes n ON n.payloadKey = o.objectKey
         LEFT JOIN discussion_write_aggregates a ON a.id = n.discussionId`
             : ''
         }
         WHERE ${
           owned
             ? 'o.ownerIdentityId = ?'
             : 'o.actorIdentityId = ? AND o.ownerIdentityId <> ?'
         }
           AND o.objectKey > ? ORDER BY o.objectKey LIMIT 128`,
        owned ? [identityId, after] : [identityId, identityId, after]
      );
      for (const row of rows) {
        signal.throwIfAborted();
        const stored = registration(row);
        if (
          stored.reference.key <= after ||
          (owned
            ? stored.ownerIdentityId !== identityId
            : stored.actorIdentityId !== identityId ||
              stored.ownerIdentityId === identityId)
        )
          return invalid();
        const current = owned && row.referenceNodeId !== null;
        if (
          current &&
          (stored.state !== 'committed' ||
            row.referenceNodeId !== stored.nodeId ||
            row.referenceOwnerId !== stored.ownerIdentityId ||
            row.referenceTenantId !== stored.tenantId ||
            row.referenceHash !== stored.reference.sha256 ||
            Number(row.referenceBytes) !== stored.reference.bytes)
        )
          return invalid();
        const shared = {
          nodeId: stored.nodeId,
          versionId: stored.reference.key.split('/')[3].slice(0, -5),
          tenantId: stored.tenantId,
          state: stored.state,
          registeredAt: stored.registeredAt,
          retiredAt: stored.retiredAt,
        };
        if (owned) {
          if (stored.state === 'retiring')
            throw new Error('Discussion payload retirement is still pending');
          const observed =
            stored.state === 'retired'
              ? { kind: 'retired' as const }
              : stored.state === 'reserved' || stored.state === 'anonymizing'
              ? await payloads.observe(stored.nodeId, stored.reference, signal)
              : {
                  kind: 'present' as const,
                  content: await payloads.read(
                    stored.nodeId,
                    stored.reference,
                    signal
                  ),
                };
          signal.throwIfAborted();
          yield {
            collection: 'payload-versions',
            data: {
              ...shared,
              current,
              sha256: stored.reference.sha256,
              bytes: stored.reference.bytes,
              uploadedBy:
                stored.actorIdentityId === null
                  ? 'unknown'
                  : stored.actorIdentityId === identityId
                  ? 'account'
                  : 'other',
              storage:
                observed.kind === 'absent' ? 'not-observed' : observed.kind,
              content: observed.kind === 'present' ? observed.content : null,
            },
          };
        } else {
          // Uploading for another owner does not authorize exporting that owner's private content or identity.
          yield { collection: 'payload-uploads', data: shared };
        }
        after = stored.reference.key;
      }
      if (rows.length < 128) break;
    }
  }
}
