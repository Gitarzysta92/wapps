import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('platforms')
export class Platform {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  name: string;

  @Column({ length: 255, unique: true })
  slug: string;
}

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  name: string;

  @Column({ length: 255, unique: true })
  slug: string;
}

@Entity('socials')
export class Social {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  name: string;

  @Column({ length: 255, unique: true })
  slug: string;
}

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  name: string;

  @Column({ length: 255, unique: true })
  slug: string;
}

@Entity('monetization_models')
export class MonetizationModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  name: string;

  @Column({ length: 255, unique: true })
  slug: string;
}

@Entity('user_spans')
export class UserSpan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  name: string;

  @Column({ length: 255, unique: true })
  slug: string;
}
