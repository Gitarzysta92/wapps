import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('content_node_relations')
export class ContentNodeRelationEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  fromContentId: string;

  @Index()
  @Column({ type: 'uuid' })
  toContentId: string;

  @Index()
  @Column({ length: 128 })
  relationType: string;

  @Index()
  @Column({ type: 'bigint' })
  createdAt: number;
}

