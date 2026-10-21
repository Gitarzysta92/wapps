import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { Platform } from '../../reference/entities/platform.entity';
import { Device } from '../../reference/entities/device.entity';
import { MonetizationModel } from '../../reference/entities/monetization-model.entity';

@Entity('app_records')
export class AppRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 255, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  website!: string | null;

  @Column({ default: false })
  isPwa!: boolean;

  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating!: number | null;

  @Column({ type: 'int', nullable: true })
  estimatedNumberOfUsers!: number | null;

  @Column({ default: false })
  isSuspended!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bannerUrl!: string | null;

  @ManyToOne(() => Category, { eager: true })
  category!: Category | null;

  @ManyToMany(() => Tag)
  @JoinTable({ name: 'app_record_tags' })
  tags!: Tag[];

  @ManyToMany(() => Platform)
  @JoinTable({ name: 'app_record_platforms' })
  platforms!: Platform[];

  @ManyToMany(() => Device)
  @JoinTable({ name: 'app_record_devices' })
  devices!: Device[];

  @ManyToMany(() => MonetizationModel)
  @JoinTable({ name: 'app_record_monetization' })
  monetizationModels!: MonetizationModel[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
