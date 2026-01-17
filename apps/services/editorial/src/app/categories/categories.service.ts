import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
  ) {}

  findAll() {
    return this.categoriesRepository.find({ relations: ['parent', 'children'] });
  }

  findOne(id: string) {
    return this.categoriesRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
  }

  findBySlug(slug: string) {
    return this.categoriesRepository.findOne({ where: { slug } });
  }

  create(data: Partial<Category>) {
    const category = this.categoriesRepository.create(data);
    return this.categoriesRepository.save(category);
  }

  async update(id: string, data: Partial<Category>) {
    await this.categoriesRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.categoriesRepository.delete(id);
    return { deleted: true };
  }
}
