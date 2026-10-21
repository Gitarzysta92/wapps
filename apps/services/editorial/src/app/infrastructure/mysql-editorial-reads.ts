import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppRecord } from '../apps/entities/app-record.entity';
import { Category } from '../categories/entities/category.entity';
import { Tag } from '../tags/entities/tag.entity';
import {
  EditorialReads,
  EditorialResourceKind,
  EditorialResourceView,
} from '../application/editorial.ports';
import { editorialRevision } from './mysql-editorial-writes';

@Injectable()
export class MysqlEditorialReads implements EditorialReads {
  constructor(
    private readonly dataSource: DataSource,
    private readonly publicTenant: string
  ) {}

  list(kind: EditorialResourceKind, tenantId: string) {
    return this.load(kind, tenantId);
  }

  async find(kind: EditorialResourceKind, id: string, tenantId: string) {
    return (await this.load(kind, tenantId, id))[0] ?? null;
  }

  private async load(
    kind: EditorialResourceKind,
    tenantId: string,
    id?: string
  ): Promise<EditorialResourceView[]> {
    const target =
      kind === 'app' ? AppRecord : kind === 'category' ? Category : Tag;
    const query = this.dataSource
      .getRepository<AppRecord | Category | Tag>(target)
      .createQueryBuilder('resource')
      .leftJoin(
        'editorial_resource_states',
        'ownership',
        'ownership.resourceId = resource.id AND ownership.resourceKind = :kind',
        { kind }
      )
      .addSelect('ownership.revision', 'resource_revision')
      .where('ownership.deletedAt IS NULL')
      .andWhere(
        '(ownership.tenantId = :tenantId OR (ownership.resourceId IS NULL AND :tenantId = :publicTenant))',
        { tenantId, publicTenant: this.publicTenant }
      )
      .orderBy('resource.id', 'ASC');
    if (id) query.andWhere('resource.id = :id', { id });
    for (const relation of kind === 'app'
      ? ['category', 'tags', 'platforms', 'devices', 'monetizationModels']
      : kind === 'category'
      ? ['parent', 'children']
      : []) {
      const relatedKind =
        relation === 'tags'
          ? 'tag'
          : ['category', 'parent', 'children'].includes(relation)
          ? 'category'
          : null;
      const access = relatedKind
        ? `(EXISTS (SELECT 1 FROM editorial_resource_states related WHERE related.resourceKind = '${relatedKind}' AND related.resourceId = ${relation}.id AND related.tenantId = :tenantId AND related.deletedAt IS NULL) OR (:tenantId = :publicTenant AND NOT EXISTS (SELECT 1 FROM editorial_resource_states related WHERE related.resourceKind = '${relatedKind}' AND related.resourceId = ${relation}.id)))`
        : undefined;
      query.leftJoinAndSelect(`resource.${relation}`, relation, access);
    }
    const result = await query.getRawAndEntities<{
      resource_id: string;
      resource_revision: string | number | null;
    }>();
    const revisions = new Map(
      result.raw.map((row) => [row.resource_id, row.resource_revision])
    );
    return result.entities.map((entity) => {
      const revision = revisions.get(entity.id);
      return {
        ...entity,
        revision: revision == null ? null : editorialRevision(revision),
      };
    });
  }
}
