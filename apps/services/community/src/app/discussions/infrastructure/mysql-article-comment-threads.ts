import type { DataSource } from 'typeorm';
import { MysqlPublicDiscussionThreads } from './mysql-public-discussion-threads';

export class MysqlArticleCommentThreads extends MysqlPublicDiscussionThreads {
  constructor(source: DataSource) {
    super(source, 'article');
  }
}
