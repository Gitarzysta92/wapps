export type EventType = string;

export type EventId = string;

/**
 * Core, transport-agnostic event metadata.
 *
 * Keep this stable and minimal: it is the backbone for tracing, replay,
 * reporting (OpenSearch), and "who depends on whose events" reasoning.
 */
export interface EventMeta<TType extends EventType = EventType> {
  /** Unique id of this event/message (recommended: UUIDv7 / UUIDv4). */
  id: EventId;

  /** Semantic event name, e.g. "discussion.materialization.requested". */
  type: TType;

  /** Schema version of this event type (integer). */
  version: number;

  /** Producer timestamp (ISO-8601). */
  occurredAt: string;

  /** Who produced this event. */
  producer: {
    service: string;
    instanceId?: string;
    environment?: string;
  };

  /**
   * Cross-boundary flow identifiers.
   *
   * - correlationId: ties a flow together (required)
   * - causationId: points to the event that caused this event (optional)
   */
  correlation: {
    correlationId: string;
    causationId?: EventId;
  };

  /**
   * W3C trace context propagation. Optional, but recommended when OTEL is used.
   */
  trace?: {
    traceparent?: string;
    tracestate?: string;
  };

  /**
   * "What this event is about" in domain terms.
   * Useful for building an application/domain graph from events.
   */
  subject?: {
    entityType: string;
    entityId: string;
    path?: string;
  };

  /** Multi-tenant context (if applicable). */
  tenant?: {
    tenantId: string;
  };

  /**
   * Actor context (keep minimal; avoid PII).
   * This is NOT authorization - just traceability.
   */
  actor?: {
    userId?: string;
    roles?: string[];
    isAnonymous?: boolean;
  };

  /** Small, bounded labels for indexing/metrics. */
  tags?: Record<string, string>;
}

export interface EventEnvelope<TType extends EventType, TPayload> {
  meta: EventMeta<TType>;
  payload: TPayload;
}

