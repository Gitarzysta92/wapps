import type { ApplicationReviews } from '../../reviews/application/application-reviews';
import type { ApplicationDiscussions } from '../application/application-discussions';
import type { ArticleComments } from '../application/article-comments';
import type {
  CommunityActivityCandidate,
  CommunityActivityReader,
} from '../application/profile-activity';

export class PublicCommunityActivityReader implements CommunityActivityReader {
  constructor(
    private readonly applications: Pick<ApplicationDiscussions, 'read'>,
    private readonly articles: Pick<ArticleComments, 'read'>,
    private readonly reviews: Pick<ApplicationReviews, 'read'>
  ) {}

  async read(candidate: CommunityActivityCandidate) {
    if (candidate.kind === 'review') {
      const review = await this.reviews.read(
        candidate.target.id,
        candidate.id,
        null
      );
      return {
        revision: review.revision,
        live: !review.hidden && !review.withdrawn,
        title: null,
      };
    }
    const rootOnly = candidate.id === candidate.rootId;
    const reader =
      candidate.target.kind === 'application'
        ? this.applications
        : this.articles;
    const thread = await reader.read(
      candidate.target.id,
      candidate.rootId,
      null,
      rootOnly
    );
    const contribution = thread.comments.find(
      (comment) => comment.id === candidate.id
    );
    return {
      revision: thread.revision,
      live: !!contribution?.content,
      title:
        'title' in thread && typeof thread.title === 'string'
          ? thread.title
          : null,
    };
  }
}
