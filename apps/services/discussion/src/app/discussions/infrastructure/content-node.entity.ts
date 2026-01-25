import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('content_nodes')
export class ContentNodeEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  referenceKey: string;

  @Index()
  @Column({ length: 128 })
  kind: string;

  @Index()
  @Column({ length: 32 })
  state: string;

  @Index()
  @Column({ length: 32 })
  visibility: string;

  @Index()
  @Column({ type: 'bigint' })
  createdAt: number;

  @Column({ type: 'bigint', nullable: true })
  updatedAt?: number;

  @Index()
  @Column({ type: 'bigint', nullable: true })
  deletedAt?: number;
}

