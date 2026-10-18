import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  compareExplore,
  parseExploreRead,
  parseExploreBatch,
  EXPLORE_PAGE_SIZE,
  EXPLORE_READER,
  EXPLORE_READER_ROLE,
  EXPLORE_READER_SCOPE,
  ExploreUnavailableError,
  type ExploreItem,
  type ExplorePosition,
  type ExploreKind,
} from '@domains/feed';
import type { DiscussionActor } from './discussion-write.port';

export interface ExploreCommunityCandidate {
  kind: 'discussion' | 'review';
  id: string;
  applicationId: string;
  at: number;
  revision: number;
}
export interface ExploreCommunityIndex {
  read(
    after: ExplorePosition | null,
    selectedKind?: ExploreKind,
    applicationId?: string
  ): Promise<ExploreCommunityCandidate[]>;
}
export interface ExploreCommunityReader {
  read(
    candidate: ExploreCommunityCandidate
  ): Promise<{ item: ExploreItem; revision: number } | null>;
  confirm(items: ExploreItem[]): Promise<void>;
}
export class ExploreCommunity {
  constructor(
    private readonly index: ExploreCommunityIndex,
    private readonly reader: ExploreCommunityReader,
    private readonly policy: IPolicyEvaluator
  ) {}
  async read(input: unknown, actor: DiscussionActor) {
    const actionName = 'discussion.explore.read';
    if (
      actor.identityId !== EXPLORE_READER ||
      actor.tenantId !== EXPLORE_READER_SCOPE ||
      !actor.roles.includes(EXPLORE_READER_ROLE)
    )
      throw new PermissionDeniedError(actionName);
    const decision = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: actor.tenantId,
      actionName,
      action: actionName,
      timestamp: Date.now(),
      subject: { roles: actor.roles },
      resource: { type: 'explore', id: 'discussion', tenantId: actor.tenantId },
    });
    if (!decision.ok)
      throw new ExploreUnavailableError('Explore authorization unavailable');
    if (decision.value !== true) throw new PermissionDeniedError(actionName);
    const { after, selectedKind, applicationId } = parseExploreRead(input, [
      'discussion',
      'review',
    ]);
    try {
      const candidates = await this.index.read(
        after,
        selectedKind,
        applicationId
      );
      if (
        candidates.length > EXPLORE_PAGE_SIZE + 1 ||
        candidates.some((c, i) => {
          const prior =
            i === 0
              ? after
              : {
                  at: candidates[i - 1].at,
                  key: `${candidates[i - 1].kind}:${candidates[i - 1].id}`,
                };
          return (
            (selectedKind && c.kind !== selectedKind) ||
            (applicationId && c.applicationId !== applicationId) ||
            (prior &&
              compareExplore(prior, { at: c.at, key: `${c.kind}:${c.id}` }) >=
                0)
          );
        })
      )
        throw new ExploreUnavailableError('Invalid Explore selection');
      const selected = candidates.slice(0, EXPLORE_PAGE_SIZE),
        items: ExploreItem[] = [];
      for (let offset = 0; offset < selected.length; offset += 5) {
        const batch = await Promise.all(
          selected.slice(offset, offset + 5).map(async (candidate) => {
            const value = await this.reader.read(candidate);
            if (!value) return null;
            const { item, revision } = value;
            if (
              !('applicationId' in item.target) ||
              item.target.applicationId !== candidate.applicationId ||
              revision !== candidate.revision ||
              item.id !== candidate.id ||
              item.kind !== candidate.kind ||
              item.at !== candidate.at
            )
              throw new ExploreUnavailableError('Explore contribution changed');
            return item;
          })
        );
        for (const item of batch) if (item) items.push(item);
      }
      await this.reader.confirm(items);
      if (
        JSON.stringify(
          await this.index.read(after, selectedKind, applicationId)
        ) !== JSON.stringify(candidates)
      )
        throw new ExploreUnavailableError('Explore authority changed');
      const last = selected[selected.length - 1];
      return parseExploreBatch({
        items,
        through:
          candidates.length > EXPLORE_PAGE_SIZE
            ? { at: last.at, key: `${last.kind}:${last.id}` }
            : null,
      });
    } catch {
      throw new ExploreUnavailableError(
        'Explore community is temporarily unavailable'
      );
    }
  }
}
