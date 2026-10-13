import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  compareExplore,
  isApplicationActivity,
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
import type { EditorialActor } from './editorial.ports';
import type { PublicationActivityCandidate } from './profile-activity';

export type ExplorePublicationCandidate = PublicationActivityCandidate;
export interface ExplorePublicationIndex {
  read(
    after: ExplorePosition | null,
    selectedKind?: ExploreKind,
    applicationId?: string
  ): Promise<ExplorePublicationCandidate[]>;
}
export interface ExplorePublicationReader {
  confirm(items: ExploreItem[]): Promise<void>;
  read(
    candidate: ExplorePublicationCandidate,
    applicationId?: string
  ): Promise<{ item: ExploreItem; revision: number }>;
}

export class ExplorePublications {
  constructor(
    private readonly index: ExplorePublicationIndex,
    private readonly reader: ExplorePublicationReader,
    private readonly policy: IPolicyEvaluator
  ) {}
  async read(input: unknown, actor: EditorialActor) {
    const actionName = 'editorial.explore.read';
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
      timestamp: Date.now(),
      subject: { roles: actor.roles },
      resource: { type: 'explore', id: 'editorial', tenantId: actor.tenantId },
    });
    if (!decision.ok)
      throw new ExploreUnavailableError('Explore authorization unavailable');
    if (decision.value !== true) throw new PermissionDeniedError(actionName);
    const { after, selectedKind, applicationId } = parseExploreRead(input, [
      'application',
      'suite',
      'article',
      'release',
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
        items.push(
          ...(await Promise.all(
            selected.slice(offset, offset + 5).map(async (candidate) => {
              const { item, revision } = await this.reader.read(
                candidate,
                applicationId
              );
              if (
                (applicationId &&
                  !isApplicationActivity(item, applicationId)) ||
                revision !== candidate.revision ||
                item.id !== candidate.id ||
                item.kind !== candidate.kind ||
                item.at !== candidate.at
              )
                throw new ExploreUnavailableError(
                  'Explore publication changed'
                );
              return item;
            })
          ))
        );
      }
      if (
        JSON.stringify(
          await this.index.read(after, selectedKind, applicationId)
        ) !== JSON.stringify(candidates)
      )
        throw new ExploreUnavailableError('Explore authority changed');
      await this.reader.confirm(items);
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
        'Explore publications are temporarily unavailable'
      );
    }
  }
}
