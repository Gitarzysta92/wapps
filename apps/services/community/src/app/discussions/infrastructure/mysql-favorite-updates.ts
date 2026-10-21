import { classificationFields } from '@domains/publication/classification';
import type { DataSource } from 'typeorm';
import {
  parseFavoriteTarget,
  parseFavoriteUpdateState,
  type FavoriteTarget,
} from '@domains/customer/favorites';
import { discussionTarget } from '@domains/community';
import type { FavoriteUpdateSource } from '@wapps/account';
import type { ProfileDiscussionParents } from '../application/profile-discussions';

export class MysqlDiscussionFavoriteUpdates implements FavoriteUpdateSource {
  constructor(
    private readonly source: DataSource,
    private readonly parents: ProfileDiscussionParents,
    private readonly tenant: string
  ) {}
  async read(input: FavoriteTarget) {
    const target = parseFavoriteTarget(input);
    if (target.kind !== 'discussions')
      throw new Error('Unsupported Discussion target');
    const before = await this.observe(target.id);
    const parents = before.root
      ? await this.parents.select([
          discussionTarget({
            kind: before.root.subjectKind,
            id: before.root.subjectId,
          }),
        ])
      : [];
    const after = await this.observe(target.id);
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error('Favorite discussion changed during lookup');
    const parent = parents.find(
      (item) =>
        item.target.id === before.root?.subjectId &&
        item.target.kind === before.root?.subjectKind
    );
    return parseFavoriteUpdateState({
      target,
      ...before.version,
      content: parent
        ? {
            title: parent.title,
            ...classificationFields(parent.classification),
            destination: {
              kind: target.kind,
              parentKind: parent.target.kind,
              slug: parent.slug,
            },
          }
        : null,
    });
  }
  private observe(id: string) {
    return this.source.transaction('REPEATABLE READ', async (tx) => {
      const [cursor]: Record<string, unknown>[] = await tx.query(
        "SELECT version,updatedAt FROM content_update_cursors WHERE targetKind='discussions' AND targetId=?",
        [id]
      );
      const [root]: Record<string, unknown>[] = await tx.query(
        `SELECT a.revision,a.subjectId,a.subjectKind FROM discussion_write_aggregates a
        JOIN content_nodes n ON n.id=a.id AND n.kind='discussion' AND n.deletedAt IS NULL AND n.state='published' AND n.visibility='public'
        JOIN discussion_write_nodes w ON w.nodeId=a.id AND w.discussionId=a.id
        WHERE a.id=? AND a.tenantId=? AND a.subjectKind IN ('application','article')`,
        [id, this.tenant]
      );
      return {
        root: root ?? null,
        version: {
          version: cursor ? Number(cursor.version) : 0,
          at: cursor ? Number(cursor.updatedAt) : 0,
        },
      };
    });
  }
}
