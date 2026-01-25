import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discussion } from './entities/discussion.entity';
import { DiscussionCreationDto, DiscussionService, IDiscussionProjectionService } from '@domains/discussion';
import { IContentNodeRepository } from '@foundation/content-system';
import { isErr, Result } from '../../../../../../libs/foundation/standard/src';

class ContentSystemRepository implements IContentNodeRepository {
  
  addNode(c: IContentNode, relations?: IContentNodeRelation[]): Promise<Result<boolean, Error>> {
    return Promise.resolve(true);
  }

  updateNode(c: IContentNode, relations: IContentNodeRelation[]): Promise<Result<boolean, Error>> {
    return Promise.resolve(true);
  }
  
  deleteNode(c: IContentNode): Promise<Result<boolean, Error>> {
    return Promise.resolve(true);
  }

  getNode<T extends IContentNode>(id: Uuidv7): Promise<Result<T, Error>> {
    return Promise.resolve(null);
  }
  
}

class AuthorityValidationService {
}

class DiscussionProjectionService {
}

class IdentificatorGenerator {
}

class DiscussionPayloadRepository {
}


@Injectable()
export class DiscussionsService {
  private discussionService: DiscussionService;
  discussionProjectionService: IDiscussionProjectionService
  constructor(
    @InjectRepository(Discussion)
    private discussionsRepository: Repository<Discussion>,
  ) {
    const contentSystemRepository = new ContentSystemRepository();
    const authorityValidationService = new AuthorityValidationService();
    const discussionProjectionService = new DiscussionProjectionService();

    const identificatorGenerator = new IdentificatorGenerator();
    const discussionPayloadRepository = new DiscussionPayloadRepository();
    this.discussionService = new DiscussionService(
      contentSystemRepository,
      authorityValidationService,
      discussionPayloadRepository,
      discussionProjectionService,
      identificatorGenerator,
    );
  }

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

  create(data: DiscussionCreationDto, ctx: ?): Result<boolean, Error> {
    return this.discussionService.addDiscussion(data, ctx)
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
