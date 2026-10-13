import type {
  EditorialAppContent,
  EditorialSnapshot,
  EditorialProjectionRequestedEvent,
} from '@apps/shared';

export function editorialId(sequence = 1): string {
  return `019a0010-0000-7000-8000-${sequence.toString(16).padStart(12, '0')}`;
}

export function appContent(): EditorialAppContent {
  return {
    name: 'Application',
    slug: 'application',
    description: 'Stored description',
    createdAtSql: '2026-10-11 00:00:00.123456',
    updatedAtSql: '2026-10-11 00:00:00.123456',
    website: 'https://example.com',
    logoUrl: null,
    bannerUrl: null,
    isPwa: false,
    rating: null,
    estimatedNumberOfUsers: null,
    isSuspended: false,
    categoryId: null,
    tagIds: [],
    platformIds: [],
    deviceIds: [],
    monetizationModelIds: [],
  };
}

export function appSnapshot(
  overrides: Partial<EditorialSnapshot> = {}
): EditorialSnapshot {
  return {
    kind: 'app',
    resourceId: editorialId(),
    tenantId: 'default',
    revision: 1,
    deletedAt: null,
    content: appContent(),
    ...overrides,
  };
}

export function editorialEvent(
  revision = 1
): EditorialProjectionRequestedEvent {
  return {
    meta: {
      id: 'editorial-outbox:1',
      type: 'editorial.materialization.requested',
      version: 1,
      occurredAt: '2026-10-11T00:00:00.000Z',
      producer: { service: 'editorial' },
      correlation: { correlationId: editorialId() },
      subject: { entityType: 'app', entityId: editorialId() },
    },
    payload: {
      kind: 'app',
      resourceId: editorialId(),
      tenantId: 'default',
      revision,
    },
  };
}
