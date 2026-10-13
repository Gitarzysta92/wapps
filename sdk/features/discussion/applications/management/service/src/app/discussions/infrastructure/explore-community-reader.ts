import { parseExploreItem, type ExploreItem } from '@domains/feed';
import { classificationFields } from '@domains/publication/classification';
import { ReviewMissingError } from '@sdk/features/review/core';
import type { ApplicationReviews } from '../../reviews/application/application-reviews';
import type { ApplicationDiscussions } from '../application/application-discussions';
import { DiscussionNotFoundError } from '../application/discussion-write.port';
import type {
  ExploreCommunityCandidate,
  ExploreCommunityReader,
} from '../application/explore-community';
import type { ProfileDiscussionParents } from '../application/profile-discussions';

export class PublicExploreCommunityReader implements ExploreCommunityReader {
  constructor(
    private readonly discussions: Pick<ApplicationDiscussions, 'read'>,
    private readonly reviews: Pick<ApplicationReviews, 'read'>,
    private readonly parents: ProfileDiscussionParents
  ) {}
  async confirm(items: ExploreItem[]) {
    const targets = items.map((item) => {
      if (!('applicationId' in item.target))
        throw new Error('Invalid Explore parent');
      return { kind: 'application' as const, id: item.target.applicationId };
    });
    const parents = await this.parents.select(targets);
    for (const item of items) {
      if (!('applicationId' in item.target))
        throw new Error('Invalid Explore parent');
      const id = item.target.applicationId;
      const parent = parents.find((parent) => parent.target.id === id);
      if (
        !parent ||
        parent.classification !== item.classification ||
        parent.slug !== item.target.applicationSlug ||
        (item.kind === 'review' && parent.title !== item.title) ||
        JSON.stringify(parent.categories ?? []) !==
          JSON.stringify(item.categories) ||
        JSON.stringify(parent.tags ?? []) !== JSON.stringify(item.tags)
      )
        throw new Error('Explore parent changed while loading the page');
    }
  }
  async read(candidate: ExploreCommunityCandidate) {
    const { kind, id, at, applicationId } = candidate;
    try {
      const parent = (
        await this.parents.select([{ kind: 'application', id: applicationId }])
      )[0];
      if (!parent) return null;
      let title: string, revision: number, engagement: number | null;
      if (kind === 'review') {
        const review = await this.reviews.read(applicationId, id, null);
        if (review.hidden || review.withdrawn) return null;
        title = parent.title;
        revision = review.revision;
        engagement = review.helpfulCount;
      } else {
        const thread = await this.discussions.read(
          applicationId,
          id,
          null,
          true
        );
        const root = thread.comments.find((comment) => comment.id === id);
        if (!root?.content) return null;
        title = thread.title;
        revision = thread.revision;
        engagement = root.votes
          ? root.votes.upvotes - root.votes.downvotes
          : null;
      }
      const current = (
        await this.parents.select([{ kind: 'application', id: applicationId }])
      )[0];
      if (!current) return null;
      if (JSON.stringify(current) !== JSON.stringify(parent))
        throw new Error('Explore parent changed');
      return {
        item: parseExploreItem({
          kind,
          id,
          at,
          title,
          target: { kind, id, applicationId, applicationSlug: parent.slug },
          categories: parent.categories ?? [],
          tags: parent.tags ?? [],
          engagement,
          ...classificationFields(parent.classification),
        }),
        revision,
      };
    } catch (error) {
      if (
        error instanceof DiscussionNotFoundError ||
        error instanceof ReviewMissingError
      )
        return null;
      throw error;
    }
  }
}
