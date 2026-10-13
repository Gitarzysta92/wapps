import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { discussionMentionRecipients } from '@sdk/features/discussion/core';
import {
  DiscussionConflictError,
  type PreparedDiscussionMutation,
} from '../application/discussion-write.port';
import { mentionNotificationJournalRow } from './mysql-mention-notifications';

export function preparedMentionRecipients(
  mutation: PreparedDiscussionMutation
) {
  if (!('payload' in mutation)) return [];
  const candidates = mutation.mentions ?? [];
  const recipients = discussionMentionRecipients(
    candidates,
    candidates.map((row) => row.profileId)
  );
  const target =
    mutation.type === 'create' ? mutation.target : mutation.resource.target;
  if (
    recipients.length &&
    (!target ||
      recipients.some(
        (row) => row.identityId === mutation.command.actor.identityId
      ))
  )
    throw new Error('Invalid prepared discussion mentions');
  return recipients;
}

/** Runs under the same recipient barriers and aggregate lock as the immutable payload binding. */
export async function commitDiscussionMentions(
  tx: EntityManager,
  mutation: PreparedDiscussionMutation,
  discussionId: string,
  revision: number,
  eligibleRecipients: string[],
  visible: boolean
): Promise<void> {
  if (mutation.type === 'update' || mutation.type === 'delete')
    await tx.query(
      'UPDATE discussion_mention_notifications SET active=0 WHERE nodeId=? AND active=1',
      [mutation.nodeId]
    );
  if (!visible || !('payload' in mutation)) return;
  for (const recipient of preparedMentionRecipients(mutation)) {
    if (!eligibleRecipients.includes(recipient.identityId)) continue;
    const rows: Record<string, unknown>[] = await tx.query(
      'SELECT * FROM discussion_mention_notifications WHERE nodeId=? AND (recipientId=? OR profileId=?) LIMIT 2 FOR UPDATE',
      [mutation.nodeId, recipient.identityId, recipient.profileId]
    );
    if (rows.length) {
      const row = mentionNotificationJournalRow(rows[0]);
      if (
        rows.length !== 1 ||
        row.event.nodeId !== mutation.nodeId ||
        row.event.discussionId !== discussionId ||
        row.event.recipientId !== recipient.identityId ||
        row.profileId !== recipient.profileId
      )
        throw new DiscussionConflictError('Mention recipient mapping changed');
      // Reactivation preserves the first event and its receipt, including suppression or quarantine.
      await tx.query(
        'UPDATE discussion_mention_notifications SET active=1 WHERE id=?',
        [row.event.id]
      );
    } else {
      await tx.query(
        'INSERT INTO discussion_mention_notifications (id,nodeId,recipientId,profileId,discussionId,revision,active,createdAt,availableAt) VALUES (?,?,?,?,?,?,1,?,?)',
        [
          randomUUID(),
          mutation.nodeId,
          recipient.identityId,
          recipient.profileId,
          discussionId,
          revision,
          mutation.at,
          mutation.at,
        ]
      );
    }
  }
}
