import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppRecord } from './entities/app-record.entity';
import { Category } from '../categories/entities/category.entity';
import { Tag } from '../tags/entities/tag.entity';
import { Device, MonetizationModel, Platform } from '../reference/entities/index';

const SCALAR_KEYS = [
  'name',
  'slug',
  'description',
  'website',
  'isPwa',
  'rating',
  'estimatedNumberOfUsers',
  'isSuspended',
  'logoUrl',
  'bannerUrl',
] as const;

async function resolveOne<T extends { id: string }>(
  repo: Repository<T>,
  v: string | T | null | undefined
): Promise<T | null> {
  if (v == null) return null;
  const id = typeof v === 'string' ? v : (v as { id?: string })?.id;
  return id ? (await repo.findOne({ where: { id } as object })) ?? null : null;
}

async function resolveMany<T extends { id: string }>(
  repo: Repository<T>,
  v: (string | T)[] | null | undefined
): Promise<T[]> {
  if (v == null || !Array.isArray(v)) return [];
  const ids = v
    .map((x) => (typeof x === 'string' ? x : (x as { id?: string })?.id))
    .filter((id): id is string => Boolean(id));
  return ids.length > 0 ? repo.find({ where: { id: In(ids) } as object }) : [];
}

@Injectable()
export class AppsService {
  constructor(
    @InjectRepository(AppRecord)
    private appsRepository: Repository<AppRecord>,
  ) {}

  findAll() {
    return this.appsRepository.find({
      relations: ['category', 'tags', 'platforms', 'devices', 'monetizationModels'],
    });
  }

  findOne(id: string) {
    return this.appsRepository.findOne({
      where: { id },
      relations: ['category', 'tags', 'platforms', 'devices', 'monetizationModels'],
    });
  }

  create(data: Partial<AppRecord>) {
    const app = this.appsRepository.create(data);
    return this.appsRepository.save(app);
  }

  async update(id: string, data: Partial<AppRecord>) {
    const app = await this.appsRepository.findOne({ where: { id } });
    if (!app) throw new NotFoundException(`App ${id} not found`);

    const em = this.appsRepository.manager;

    for (const k of SCALAR_KEYS) {
      if (data[k] !== undefined) (app as unknown as Record<string, unknown>)[k] = data[k];
    }

    if (data.category !== undefined) {
      (app as { category: Category | null }).category = await resolveOne(
        em.getRepository(Category),
        data.category
      );
    }
    if (data.tags !== undefined) {
      app.tags = await resolveMany(em.getRepository(Tag), data.tags);
    }
    if (data.platforms !== undefined) {
      app.platforms = await resolveMany(em.getRepository(Platform), data.platforms);
    }
    if (data.devices !== undefined) {
      app.devices = await resolveMany(em.getRepository(Device), data.devices);
    }
    if (data.monetizationModels !== undefined) {
      app.monetizationModels = await resolveMany(
        em.getRepository(MonetizationModel),
        data.monetizationModels
      );
    }

    await this.appsRepository.save(app);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.appsRepository.delete(id);
    return { deleted: true };
  }
}
