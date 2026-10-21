export interface DiscussionProjectionAuthority {
  id: string;
  tenantId: string;
  revision: number;
  nodeCount: number;
}

export interface DiscussionReconciliationSource {
  upperBound(): Promise<string>;
  page(
    afterId: string,
    throughId: string,
    limit: number
  ): Promise<DiscussionProjectionAuthority[]>;
  current(id: string): Promise<DiscussionProjectionAuthority | null>;
  /** Enqueues only if the inspected authoritative revision still matches. */
  requeue(authority: DiscussionProjectionAuthority): Promise<boolean>;
}

export type DiscussionProjectionCondition =
  | 'current'
  | 'missing'
  | 'stale'
  | 'incomplete'
  | 'ahead'
  | 'conflict';

export interface DiscussionProjectionInspector {
  inspect(
    authority: DiscussionProjectionAuthority
  ): Promise<DiscussionProjectionCondition>;
}

export interface DiscussionReconciliationReport {
  examined: number;
  current: number;
  needsRebuild: number;
  queued: number;
  changed: number;
  conflicts: number;
  failed: number;
}

export async function reconcileDiscussions(
  source: DiscussionReconciliationSource,
  projections: DiscussionProjectionInspector,
  options: {
    apply?: boolean;
    batchSize?: number;
    onResult?: (
      id: string,
      condition: DiscussionProjectionCondition | 'changed' | 'failed',
      queued: boolean
    ) => void;
  } = {}
): Promise<DiscussionReconciliationReport> {
  const batchSize = options.batchSize ?? 200;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000)
    throw new Error('Invalid reconciliation batch size');
  const report: DiscussionReconciliationReport = {
    examined: 0,
    current: 0,
    needsRebuild: 0,
    queued: 0,
    changed: 0,
    conflicts: 0,
    failed: 0,
  };
  const throughId = await source.upperBound();
  let afterId = '';
  while (afterId < throughId) {
    const page = await source.page(afterId, throughId, batchSize);
    if (!page.length) break;
    if (
      page.length > batchSize ||
      page.some(
        (item, index) =>
          item.id <= (index ? page[index - 1].id : afterId) ||
          item.id > throughId
      )
    )
      throw new Error('Invalid reconciliation page order');
    for (const authority of page) {
      report.examined++;
      let condition: DiscussionProjectionCondition | 'changed' | 'failed';
      let queued = false;
      try {
        condition = await projections.inspect(authority);
        if (condition === 'current') report.current++;
        else if (condition === 'ahead') {
          const latest = await source.current(authority.id);
          if (!latest || latest.revision !== authority.revision) {
            condition = 'changed';
            report.changed++;
          } else report.conflicts++;
        } else if (condition === 'conflict') report.conflicts++;
        else {
          report.needsRebuild++;
          if (options.apply) {
            queued = await source.requeue(authority);
            if (queued) report.queued++;
            else {
              condition = 'changed';
              report.changed++;
            }
          }
        }
      } catch {
        condition = 'failed';
        report.failed++;
      }
      options.onResult?.(authority.id, condition, queued);
    }
    afterId = page[page.length - 1].id;
  }
  return report;
}
