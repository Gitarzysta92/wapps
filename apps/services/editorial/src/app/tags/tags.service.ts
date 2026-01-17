import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './entities/tag.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private tagsRepository: Repository<Tag>,
  ) {}

  findAll() {
    return this.tagsRepository.find();
  }

  findOne(id: string) {
    return this.tagsRepository.findOne({ where: { id } });
  }

  findBySlug(slug: string) {
    return this.tagsRepository.findOne({ where: { slug } });
  }

  create(data: Partial<Tag>) {
    const tag = this.tagsRepository.create(data);
    return this.tagsRepository.save(tag);
  }

  async update(id: string, data: Partial<Tag>) {
    await this.tagsRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.tagsRepository.delete(id);
    return { deleted: true };
  }
}
