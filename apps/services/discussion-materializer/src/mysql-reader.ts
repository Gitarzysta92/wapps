import type { Pool } from 'mysql2/promise';
import { DISCUSSES_RELATION_TYPE, REPLIES_RELATION_TYPE } from '@domains/discussion';

export type ContentNodeRow = {
  id: string;
  referenceKey: string;
  kind: string;
  state: string;
  visibility: string;
  createdAt: number;
  updatedAt: number | null;
  deletedAt: number | null;
};

export type ContentNodeRelationRow = {
  id: string;
  fromContentId: string;
  toContentId: string;
  relationType: string;
  createdAt: number;
};

export async function getNode(pool: Pool, id: string): Promise<ContentNodeRow | null> {
  const [rows] = await pool.query(
    `SELECT id, referenceKey, kind, state, visibility, createdAt, updatedAt, deletedAt
     FROM content_nodes
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  const r = (rows as any[])[0];
  if (!r) return null;
  return r as ContentNodeRow;
}

export async function getRelationsFrom(pool: Pool, fromContentId: string): Promise<ContentNodeRelationRow[]> {
  const [rows] = await pool.query(
    `SELECT id, fromContentId, toContentId, relationType, createdAt
     FROM content_node_relations
     WHERE fromContentId = ?`,
    [fromContentId]
  );
  return rows as ContentNodeRelationRow[];
}

export function pickReplyParentId(rels: ContentNodeRelationRow[]): string | null {
  const r = rels.find((x) => x.relationType === REPLIES_RELATION_TYPE);
  return r?.toContentId ?? null;
}

export function pickDiscussedSubjectId(rels: ContentNodeRelationRow[]): string | null {
  const r = rels.find((x) => x.relationType === DISCUSSES_RELATION_TYPE);
  return r?.toContentId ?? null;
}

/**
 * Walk REPLIES chain to the root discussion.
 * This is O(depth) queries; OK for now, but can be cached in Mongo later.
 */
export async function resolveDiscussionRoot(
  pool: Pool,
  startNodeId: string
): Promise<{ discussionId: string; depth: number }> {
  let currentId = startNodeId;
  let depth = 0;

  // Guard against cycles
  const seen = new Set<string>();

  while (true) {
    if (seen.has(currentId)) {
      // cycle detected; fall back to current as root
      return { discussionId: currentId, depth };
    }
    seen.add(currentId);

    const node = await getNode(pool, currentId);
    if (!node) return { discussionId: currentId, depth };
    if (node.kind === 'discussion') return { discussionId: node.id, depth };

    const rels = await getRelationsFrom(pool, currentId);
    const parentId = pickReplyParentId(rels);
    if (!parentId) return { discussionId: currentId, depth };

    currentId = parentId;
    depth += 1;
  }
}

