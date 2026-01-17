import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinTable, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { Platform } from '../../reference/entities/platform.entity';
import { Device } from '../../reference/entities/device.entity';
import { MonetizationModel } from '../../reference/entities/monetization-model.entity';

@Entity('app_records')
export class AppRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 500, nullable: true })
  website: string;

  @Column({ default: false })
  isPwa: boolean;

  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating: number;

  @Column({ nullable: true })
  estimatedNumberOfUsers: number;

  @Column({ default: false })
  isSuspended: boolean;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  bannerUrl: string;

  @ManyToOne(() => Category, { eager: true })
  category: Category;

  @ManyToMany(() => Tag)
  @JoinTable({ name: 'app_record_tags' })
  tags: Tag[];

  @ManyToMany(() => Platform)
  @JoinTable({ name: 'app_record_platforms' })
  platforms: Platform[];

  @ManyToMany(() => Device)
  @JoinTable({ name: 'app_record_devices' })
  devices: Device[];

  @ManyToMany(() => MonetizationModel)
  @JoinTable({ name: 'app_record_monetization' })
  monetizationModels: MonetizationModel[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
