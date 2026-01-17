import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppRecord } from './entities/app-record.entity';

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
    await this.appsRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.appsRepository.delete(id);
    return { deleted: true };
  }
}
