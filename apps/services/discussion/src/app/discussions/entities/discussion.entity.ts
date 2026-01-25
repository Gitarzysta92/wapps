import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('discussions')
export class Discussion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ length: 255, unique: true })
  slug: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ length: 255 })
  authorId: string;

  @Column({ length: 255, nullable: true })
  authorName: string;

  @Column({ length: 500, nullable: true })
  authorAvatar: string;

  @Column({ type: 'uuid', nullable: true })
  correlationId: string;

  @Column({ length: 255, nullable: true })
  correlationSlug: string;

  @Column({ default: 0 })
  repliesCount: number;

  @Column({ default: 0 })
  viewsCount: number;

  @Column({ default: 0 })
  upvotesCount: number;

  @Column({ default: 0 })
  downvotesCount: number;

  @Column({ default: false })
  isPinned: boolean;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ type: 'timestamp', nullable: true })
  editedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  parentThreadId: string;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
