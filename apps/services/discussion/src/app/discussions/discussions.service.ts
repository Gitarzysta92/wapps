import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discussion } from './entities/discussion.entity';

@Injectable()
export class DiscussionsService {
  constructor(
    @InjectRepository(Discussion)
    private discussionsRepository: Repository<Discussion>,
  ) {}

  findAll() {
    return this.discussionsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string) {
    return this.discussionsRepository.findOne({
      where: { id },
    });
  }

  create(data: Partial<Discussion>) {
    const discussion = this.discussionsRepository.create(data);
    return this.discussionsRepository.save(discussion);
  }

  async update(id: string, data: Partial<Discussion>) {
    await this.discussionsRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.discussionsRepository.delete(id);
    return { deleted: true };
  }
}
