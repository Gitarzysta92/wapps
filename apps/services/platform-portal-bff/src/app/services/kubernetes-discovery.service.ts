import { Injectable, Logger } from '@nestjs/common';
import * as k8s from '@kubernetes/client-node';

type PlatformManifestHint = Record<string, unknown>;

type DiscoverySource = { kind: 'Ingress' | 'Service'; namespace?: string; name?: string };

type DeploymentStatus = {
  kind: 'Deployment';
  namespace: string;
  name: string;
  replicas: number;
  readyReplicas: number;
  updatedReplicas: number;
  availableReplicas: number;
  images: string[];
};

type CronJobRun = {
  name: string;
  startedAt?: string;
  finishedAt?: string;
  status: 'active' | 'succeeded' | 'failed' | 'unknown';
};

type CronJobStatus = {
  kind: 'CronJob';
  namespace: string;
  name: string;
  schedule: string;
  suspend: boolean;
  concurrencyPolicy?: string;
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
  recentRuns: CronJobRun[];
};

export type DiscoveredService = {
  id: string;
  publicUrls: string[];
  internalUrls: string[];
  sources: DiscoverySource[];
  manifestHint?: PlatformManifestHint;
  deployments: DeploymentStatus[];
  cronJobs: CronJobStatus[];
};

@Injectable()
export class KubernetesDiscoveryService {
  private readonly logger = new Logger(KubernetesDiscoveryService.name);
  private readonly networkingApi: k8s.NetworkingV1Api;
  private readonly coreApi: k8s.CoreV1Api;
  private readonly appsApi: k8s.AppsV1Api;
  private readonly batchApi: k8s.BatchV1Api;

  private readonly scheme = process.env.PUBLIC_URL_SCHEME || 'https';
  private readonly hostSuffixAllowList = (process.env.PUBLIC_HOST_SUFFIX_ALLOW_LIST ||
    '.wapps.ai,.wapps.local')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  private readonly requireAppLabel =
    (process.env.DISCOVERY_REQUIRE_APP_LABEL || 'true').toLowerCase() === 'true';

  private readonly internalServiceDiscoveryEnabled =
    (process.env.INTERNAL_SERVICE_DISCOVERY_ENABLED || 'true').toLowerCase() === 'true';

  private readonly workloadDiscoveryEnabled =
    (process.env.WORKLOAD_DISCOVERY_ENABLED || 'true').toLowerCase() === 'true';

  private readonly internalScheme = process.env.INTERNAL_URL_SCHEME || 'http';
  private readonly internalServiceHostSuffix = process.env.INTERNAL_SERVICE_HOST_SUFFIX || 'svc.cluster.local';

  private readonly excludedNamespaces = new Set(
    (process.env.INTERNAL_NAMESPACE_EXCLUDE_LIST ||
      'kube-system,kube-public,kube-node-lease,ingress-nginx,argocd')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );

  private shouldDiscover(meta: { labels?: Record<string, string>; annotations?: Record<string, string> }): boolean {
    const annotations = meta.annotations || {};
    const labels = meta.labels || {};

    const discover = (annotations['platform.wapps.ai/discover'] || '').toLowerCase();
    if (discover === 'false' || discover === '0' || discover === 'no') return false;
    if (discover === 'true' || discover === '1' || discover === 'yes') return true;

    if (!this.requireAppLabel) return true;

    return Boolean(labels['app'] || labels['app.kubernetes.io/name']);
  }

  constructor() {
    const kc = new k8s.KubeConfig();
    try {
      kc.loadFromCluster();
      this.logger.log('Using in-cluster Kubernetes config');
    } catch {
      kc.loadFromDefault();
      this.logger.warn('Using default kubeconfig (not in cluster)');
    }

    this.networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
    this.coreApi = kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = kc.makeApiClient(k8s.AppsV1Api);
    this.batchApi = kc.makeApiClient(k8s.BatchV1Api);
  }

  private isAllowedHost(host: string): boolean {
    return this.hostSuffixAllowList.some((suffix) => host.endsWith(suffix));
  }

  private getServiceIdFromIngress(i: k8s.V1Ingress): string {
    const labels = i.metadata?.labels || {};
    return (
      labels['app'] ||
      labels['app.kubernetes.io/name'] ||
      i.metadata?.name ||
      i.metadata?.generateName ||
      'unknown'
    );
  }

  private getServiceIdFromService(s: k8s.V1Service): string {
    const labels = s.metadata?.labels || {};
    return labels['app'] || labels['app.kubernetes.io/name'] || s.metadata?.name || 'unknown';
  }

  private getServiceIdFromDeployment(d: k8s.V1Deployment): string {
    const labels = d.metadata?.labels || {};
    return labels['app'] || labels['app.kubernetes.io/name'] || d.metadata?.name || 'unknown';
  }

  private getServiceIdFromCronJob(cj: k8s.V1CronJob): string {
    const labels = cj.metadata?.labels || {};
    return labels['app'] || labels['app.kubernetes.io/name'] || cj.metadata?.name || 'unknown';
  }

  private parseManifestHint(annotations: Record<string, string> | undefined): PlatformManifestHint | undefined {
    if (!annotations) return undefined;
    const raw = annotations['platform.wapps.ai/manifest'];
    if (!raw) return undefined;
    try {
      return JSON.parse(raw.trim()) as PlatformManifestHint;
    } catch (e) {
      this.logger.warn(`Failed to parse platform manifest annotation: ${(e as Error)?.message ?? String(e)}`);
      return undefined;
    }
  }

  private ensureEntry(
    byId: Map<
      string,
      {
        publicUrls: Set<string>;
        internalUrls: Set<string>;
        sources: DiscoverySource[];
        manifestHint?: PlatformManifestHint;
        deployments: DeploymentStatus[];
        cronJobs: CronJobStatus[];
      }
    >,
    id: string
  ): {
    publicUrls: Set<string>;
    internalUrls: Set<string>;
    sources: DiscoverySource[];
    manifestHint?: PlatformManifestHint;
    deployments: DeploymentStatus[];
    cronJobs: CronJobStatus[];
  } {
    if (!byId.has(id)) {
      byId.set(id, {
        publicUrls: new Set(),
        internalUrls: new Set(),
        sources: [],
        deployments: [],
        cronJobs: [],
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return byId.get(id)!;
  }

  private addUrl(
    byId: Map<
      string,
      {
        publicUrls: Set<string>;
        internalUrls: Set<string>;
        sources: DiscoverySource[];
        manifestHint?: PlatformManifestHint;
        deployments: DeploymentStatus[];
        cronJobs: CronJobStatus[];
      }
    >,
    id: string,
    url: string,
    source: DiscoverySource,
    kind: 'public' | 'internal'
  ) {
    const entry = this.ensureEntry(byId, id);
    entry.sources.push(source);
    if (kind === 'public') entry.publicUrls.add(url);
    else entry.internalUrls.add(url);
  }

  private addWorkload(
    byId: Map<
      string,
      {
        publicUrls: Set<string>;
        internalUrls: Set<string>;
        sources: DiscoverySource[];
        manifestHint?: PlatformManifestHint;
        deployments: DeploymentStatus[];
        cronJobs: CronJobStatus[];
      }
    >,
    id: string,
    workload: { kind: 'Deployment' | 'CronJob'; namespace: string; name: string; annotations?: Record<string, string> }
  ) {
    const entry = this.ensureEntry(byId, id);

    // Add a stable internal reference so it shows up even without a Service/Ingress.
    entry.internalUrls.add(`k8s://${workload.kind.toLowerCase()}/${workload.namespace}/${workload.name}`);

    const hint = this.parseManifestHint(workload.annotations);
    if (hint && !entry.manifestHint) {
      entry.manifestHint = hint;
    }
  }

  async discover(): Promise<DiscoveredService[]> {
    const res = await this.networkingApi.listIngressForAllNamespaces();
    const ingresses = res.items || [];

    const byId = new Map<
      string,
      {
        publicUrls: Set<string>;
        internalUrls: Set<string>;
        sources: DiscoverySource[];
        manifestHint?: PlatformManifestHint;
        deployments: DeploymentStatus[];
        cronJobs: CronJobStatus[];
      }
    >();

    for (const i of ingresses) {
      if (!this.shouldDiscover({ labels: i.metadata?.labels || {}, annotations: i.metadata?.annotations || {} })) {
        continue;
      }
      const rules = i.spec?.rules || [];
      if (rules.length === 0) continue;

      const id = this.getServiceIdFromIngress(i);
      const ingressSource = { kind: 'Ingress' as const, namespace: i.metadata?.namespace, name: i.metadata?.name };

      for (const rule of rules) {
        const host = rule.host;
        if (!host) continue;
        if (!this.isAllowedHost(host)) continue;

        const paths = rule.http?.paths || [];
        if (paths.length === 0) {
          this.addUrl(byId, id, `${this.scheme}://${host}/`, ingressSource, 'public');
          continue;
        }

        for (const p of paths) {
          const rawPath = p.path || '/';
          if (!rawPath.startsWith('/')) continue;
          // Skip regex-like paths (these are typically internal routing, not public URLs)
          if (/[()$]/.test(rawPath)) continue;

          const url = rawPath === '/' ? `${this.scheme}://${host}/` : `${this.scheme}://${host}${rawPath}`;
          this.addUrl(byId, id, url, ingressSource, 'public');
        }
      }
    }

    if (this.internalServiceDiscoveryEnabled) {
      const serviceList = await this.coreApi.listServiceForAllNamespaces();
      const services = serviceList.items || [];

      for (const s of services) {
        if (!this.shouldDiscover({ labels: s.metadata?.labels || {}, annotations: s.metadata?.annotations || {} })) {
          continue;
        }
        const ns = s.metadata?.namespace;
        const name = s.metadata?.name;
        if (!ns || !name) continue;
        if (this.excludedNamespaces.has(ns)) continue;

        // Skip services without ports (e.g., some headless / external-name patterns)
        const ports = s.spec?.ports || [];
        if (ports.length === 0) continue;

        const id = this.getServiceIdFromService(s);
        const svcSource = { kind: 'Service' as const, namespace: ns, name };
        const host = `${name}.${ns}.${this.internalServiceHostSuffix}`;

        for (const p of ports) {
          const port = p.port;
          const portName = (p.name || '').toLowerCase();
          const scheme = portName.includes('https') || port === 443 ? 'https' : this.internalScheme;
          const isDefaultPort = (scheme === 'http' && port === 80) || (scheme === 'https' && port === 443);
          const url = isDefaultPort ? `${scheme}://${host}/` : `${scheme}://${host}:${port}/`;
          this.addUrl(byId, id, url, svcSource, 'internal');
        }
      }
    }

    if (this.workloadDiscoveryEnabled) {
      const depList = await this.appsApi.listDeploymentForAllNamespaces();
      const deps = depList.items || [];
      for (const d of deps) {
        if (!this.shouldDiscover({ labels: d.metadata?.labels || {}, annotations: d.metadata?.annotations || {} })) {
          continue;
        }
        const ns = d.metadata?.namespace;
        const name = d.metadata?.name;
        if (!ns || !name) continue;
        if (this.excludedNamespaces.has(ns)) continue;
        const id = this.getServiceIdFromDeployment(d);
        this.addWorkload(byId, id, {
          kind: 'Deployment',
          namespace: ns,
          name,
          annotations: d.metadata?.annotations || undefined,
        });

        const images =
          d.spec?.template?.spec?.containers?.map((c) => c.image).filter((x): x is string => Boolean(x)) || [];
        const st = d.status || {};
        const entry = this.ensureEntry(byId, id);
        entry.deployments.push({
          kind: 'Deployment',
          namespace: ns,
          name,
          replicas: st.replicas ?? 0,
          readyReplicas: st.readyReplicas ?? 0,
          updatedReplicas: st.updatedReplicas ?? 0,
          availableReplicas: st.availableReplicas ?? 0,
          images,
        });
      }

      const cjList = await this.batchApi.listCronJobForAllNamespaces();
      const cjs = cjList.items || [];

      // Preload Jobs for richer CronJob status (best effort).
      let jobs: k8s.V1Job[] = [];
      try {
        const jobList = await this.batchApi.listJobForAllNamespaces();
        jobs = jobList.items || [];
      } catch (e) {
        this.logger.warn(`Unable to list Jobs for CronJob status: ${(e as Error)?.message ?? String(e)}`);
      }

      for (const cj of cjs) {
        if (!this.shouldDiscover({ labels: cj.metadata?.labels || {}, annotations: cj.metadata?.annotations || {} })) {
          continue;
        }
        const ns = cj.metadata?.namespace;
        const name = cj.metadata?.name;
        if (!ns || !name) continue;
        if (this.excludedNamespaces.has(ns)) continue;
        const id = this.getServiceIdFromCronJob(cj);
        this.addWorkload(byId, id, {
          kind: 'CronJob',
          namespace: ns,
          name,
          annotations: cj.metadata?.annotations || undefined,
        });

        const recentRuns: CronJobRun[] = jobs
          .filter((j) => j.metadata?.namespace === ns)
          .filter((j) => {
            const owners = j.metadata?.ownerReferences || [];
            return owners.some((o) => o.kind === 'CronJob' && o.name === name);
          })
          .map((j) => {
            const st = j.status || {};
            const status: CronJobRun['status'] =
              (st.active ?? 0) > 0
                ? 'active'
                : (st.succeeded ?? 0) > 0
                  ? 'succeeded'
                  : (st.failed ?? 0) > 0
                    ? 'failed'
                    : 'unknown';

            return {
              name: j.metadata?.name || 'unknown',
              startedAt: st.startTime ? new Date(st.startTime as unknown as string).toISOString() : undefined,
              finishedAt: st.completionTime
                ? new Date(st.completionTime as unknown as string).toISOString()
                : undefined,
              status,
            };
          })
          .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))
          .slice(0, 5);

        const entry = this.ensureEntry(byId, id);
        entry.cronJobs.push({
          kind: 'CronJob',
          namespace: ns,
          name,
          schedule: cj.spec?.schedule || '',
          suspend: Boolean(cj.spec?.suspend),
          concurrencyPolicy: cj.spec?.concurrencyPolicy,
          lastScheduleTime: cj.status?.lastScheduleTime
            ? new Date(cj.status.lastScheduleTime as unknown as string).toISOString()
            : undefined,
          lastSuccessfulTime: cj.status?.lastSuccessfulTime
            ? new Date(cj.status.lastSuccessfulTime as unknown as string).toISOString()
            : undefined,
          recentRuns,
        });
      }
    }

    return Array.from(byId.entries())
      .map(([id, v]) => ({
        id,
        publicUrls: Array.from(v.publicUrls).sort(),
        internalUrls: Array.from(v.internalUrls).sort(),
        sources: v.sources,
        manifestHint: v.manifestHint,
        deployments: v.deployments,
        cronJobs: v.cronJobs,
      }))
      .filter((s) => s.publicUrls.length > 0 || s.internalUrls.length > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
  }
}

