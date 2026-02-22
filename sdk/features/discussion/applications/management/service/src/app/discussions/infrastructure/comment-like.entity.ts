import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('comment_likes')
@Index(['commentId', 'actorIdentityId'], { unique: true })
export class CommentLikeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  commentId!: string;

  /**
   * Canonical actor id: maps to `IAuthorityValidationContext.identityId`.
   * This is intentionally NOT a domain-specific user id abstraction.
   */
  @Column({ length: 128 })
  actorIdentityId!: string;

  @Column({ type: 'bigint' })
  createdAt!: number;
}

