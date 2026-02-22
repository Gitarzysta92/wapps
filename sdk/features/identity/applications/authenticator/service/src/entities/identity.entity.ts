import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('identities')
export class IdentityEntity implements  {
  @PrimaryColumn()
  id!: string;

  @Column({ name: 'identity_id' })
  identityId!: string;

  @Index({ unique: true })
  @Column()
  claim!: string;

  @Column({ length: 64 })
  kind!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'is_suspended', default: false })
  isSuspended!: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDeleted!: boolean;

  @Column({ name: 'provider_type', length: 64 })
  providerType!: string;

  @Column({ name: 'provider_secret', nullable: true })
  providerSecret!: string | null;

  @Column({ name: 'created_at', type: 'bigint' })
  createdAt!: number;

  @Column({ name: 'updated_at', type: 'bigint' })
  updatedAt!: number;

  @Column({ name: 'deleted_at', type: 'bigint', default: 0 })
  deletedAt!: number;
}
