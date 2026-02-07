import { Injectable, Logger } from '@nestjs/common';
import { DiscoveredService, KubernetesDiscoveryService } from './kubernetes-discovery.service';

type PlatformManifest = {
  id?: string;
  name?: string;
  type?: string;
  runtime?: string;
  environment?: string;
  version?: string;
  commitSha?: string;
  builtAt?: string;
  endpoints?: Record<string, string>;
  extras?: Array<{ label: string; url: string }>;
  tags?: string[];
  owner?: string;
};

function isPlatformManifest(v: unknown): v is PlatformManifest {
  return typeof v === 'object' && v !== null;
}

function titleCaseFromId(id: string) {
  return id
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function safeOrigin(url: string): string | null {
  try {
    // Node's WHATWG URL returns the literal string "null" for opaque origins
    // (e.g. custom schemes like k8s://..., and file://). Treat those as invalid.
    const origin = new URL(url).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

function normalizeManifest(input: PlatformManifest | null, fallback: { id: string; name: string }): PlatformManifest {
  const m = input || {};
  return {
    id: m.id || fallback.id,
    name: m.name || fallback.name,
    type: m.type || 'unknown',
    runtime: m.runtime || 'unknown',
    environment: m.environment || 'unknown',
    version: m.version,
    commitSha: m.commitSha,
    builtAt: m.builtAt,
    endpoints: m.endpoints || {},
    extras: m.extras || [],
    tags: m.tags || [],
    owner: m.owner,
  };
}

function joinOriginAndPath(origin: string, path: string): string | null {
  if (!path) return null;
  if (!path.startsWith('/')) return null;
  return `${origin}${path}`;
}

function extrasFromManifestEndpoints(
  origin: string | null,
  endpoints: Record<string, string> | undefined
): Array<{ label: string; url: string }> {
  if (!origin) return [];
  if (!endpoints) return [];

  const items: Array<{ label: string; url: string } | null> = [
    endpoints.docs ? { label: 'Swagger', url: joinOriginAndPath(origin, endpoints.docs) || '' } : null,
    endpoints.openapiJson
      ? { label: 'OpenAPI JSON', url: joinOriginAndPath(origin, endpoints.openapiJson) || '' }
      : null,
    endpoints.health ? { label: 'Health', url: joinOriginAndPath(origin, endpoints.health) || '' } : null,
    endpoints.ready ? { label: 'Ready', url: joinOriginAndPath(origin, endpoints.ready) || '' } : null,
    endpoints.platform
      ? { label: 'Platform manifest', url: joinOriginAndPath(origin, endpoints.platform) || '' }
      : null,
  ];

  // Filter invalid + dedupe by URL (preserve order).
  const out: Array<{ label: string; url: string }> = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (!it) continue;
    if (!it.url) continue;
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    out.push(it);
  }
  return out;
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  private cache:
    | {
        at: number;
        payload: unknown;
      }
    | undefined;

  private readonly cacheTtlMs = Number(process.env.SERVICE_DIRECTORY_CACHE_TTL_MS || 60_000);
  private readonly enrichTimeoutMs = Number(process.env.SERVICE_DIRECTORY_ENRICH_TIMEOUT_MS || 2_000);

  constructor(private readonly discovery: KubernetesDiscoveryService) {}

  private async tryFetchJson<T>(url: string, timeoutMs: number): Promise<T | null> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: ac.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  private inferExtrasFromUrls(urls: string[]): Array<{ label: string; url: string }> {
    const origins = Array.from(new Set(urls.map(safeOrigin).filter(Boolean))) as string[];
    if (origins.length === 0) return [];
    const origin = origins[0];

    // Heuristic: if the service exposes /api, offer standard Nest-ish conveniences
    if (urls.some((u) => u.includes('/api') || u.endsWith('/api'))) {
      return [
        { label: 'Swagger', url: `${origin}/api/docs` },
        { label: 'OpenAPI JSON', url: `${origin}/api/docs-json` },
        { label: 'Health', url: `${origin}/api/health` },
        { label: 'Ready', url: `${origin}/api/health/ready` },
        { label: 'Platform manifest', url: `${origin}/api/platform` },
      ];
    }

    return [{ label: 'Platform manifest', url: `${origin}/.well-known/platform.json` }];
  }

  private async enrichWithPlatformManifest(
    svc: DiscoveredService
  ): Promise<{ origin: string | null; manifest: PlatformManifest | null; inferredExtras: Array<{ label: string; url: string }> }> {
    const publicOrigins = Array.from(new Set(svc.publicUrls.map(safeOrigin).filter(Boolean))) as string[];
    const internalOrigins = Array.from(new Set(svc.internalUrls.map(safeOrigin).filter(Boolean))) as string[];
    const origin = publicOrigins[0] || internalOrigins[0];
    const allUrls = [...svc.publicUrls, ...svc.internalUrls];
    const hinted = isPlatformManifest(svc.manifestHint) ? (svc.manifestHint as PlatformManifest) : null;
    if (!origin) return { origin: null, manifest: hinted, inferredExtras: this.inferExtrasFromUrls(allUrls) };

    const manifest =
      hinted ||
      (await this.tryFetchJson<PlatformManifest>(`${origin}/.well-known/platform.json`, this.enrichTimeoutMs)) ||
      (await this.tryFetchJson<PlatformManifest>(`${origin}/api/platform`, this.enrichTimeoutMs));

    return {
      origin,
      manifest,
      inferredExtras: this.inferExtrasFromUrls(allUrls),
    };
  }

  private normalizePublicBaseUrl(raw: string | undefined): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const u = new URL(trimmed);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.origin + (u.pathname.endsWith('/') ? u.pathname : u.pathname + '/');
    } catch {
      return null;
    }
  }

  async list(opts?: { refresh?: boolean }) {
    const now = Date.now();
    if (!opts?.refresh && this.cache && now - this.cache.at < this.cacheTtlMs) {
      return this.cache.payload;
    }

    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'unknown';
    const publicBaseUrl = this.normalizePublicBaseUrl(process.env.PLATFORM_PUBLIC_URL);
    const discovered = await this.discovery.discover();

    const services = await Promise.all(
      discovered.map(async (svc) => {
        const { origin, manifest, inferredExtras } = await this.enrichWithPlatformManifest(svc);
        const name = manifest?.name || titleCaseFromId(svc.id);
        const normalized = normalizeManifest(manifest, { id: svc.id, name });
        const inferredFromManifest = extrasFromManifestEndpoints(origin, normalized.endpoints);
        const extras = (
          normalized.extras?.length ? normalized.extras : inferredFromManifest.length ? inferredFromManifest : inferredExtras
        ).slice(0, 25);

        let publicUrls = [...svc.publicUrls];
        if (publicBaseUrl && (svc.id === 'platform-portal-csr' || svc.id === 'platform-portal-bff')) {
          if (!publicUrls.includes(publicBaseUrl)) {
            publicUrls = [publicBaseUrl, ...publicUrls];
          }
        }

        return {
          id: svc.id,
          name,
          publicUrls,
          internalUrls: svc.internalUrls,
          extras,
          manifest: normalized,
          deployments: svc.deployments,
          cronJobs: svc.cronJobs,
          sources: svc.sources,
        };
      })
    );

    const payload = {
      generatedAt: new Date().toISOString(),
      environment,
      ...(publicBaseUrl && { publicBaseUrl }),
      services,
    };

    this.cache = { at: now, payload };
    this.logger.log(`Service directory generated: ${services.length} services (env=${environment})`);
    return payload;
  }
}

