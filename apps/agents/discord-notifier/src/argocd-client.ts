import axios, { AxiosInstance } from 'axios';

export interface ArgoCDApplication {
  name: string;
  namespace: string;
  health: {
    status: string;
  };
  sync: {
    status: string;
    revision?: string;
  };
  operationState?: {
    phase: string;
    startedAt: string;
    finishedAt?: string;
  };
}

export interface ArgoCDData {
  applications: ArgoCDApplication[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    synced: number;
    outOfSync: number;
  };
}

export class ArgoCDClient {
  private client: AxiosInstance;

  constructor(serverUrl: string, username: string, password: string) {
    this.client = axios.create({
      baseURL: serverUrl,
      auth: {
        username,
        password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      // ArgoCD often uses self-signed certs in dev
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false,
      }),
    });
  }

  async fetchApplicationsStatus(): Promise<ArgoCDData> {
    try {
      const response = await this.client.get('/api/v1/applications');
      const apps: ArgoCDApplication[] = response.data.items.map((app: any) => ({
        name: app.metadata.name,
        namespace: app.metadata.namespace,
        health: {
          status: app.status.health?.status || 'Unknown',
        },
        sync: {
          status: app.status.sync?.status || 'Unknown',
          revision: app.status.sync?.revision?.substring(0, 7),
        },
        operationState: app.status.operationState
          ? {
              phase: app.status.operationState.phase,
              startedAt: app.status.operationState.startedAt,
              finishedAt: app.status.operationState.finishedAt,
            }
          : undefined,
      }));

      const summary = {
        total: apps.length,
        healthy: apps.filter((app) => app.health.status === 'Healthy').length,
        degraded: apps.filter(
          (app) => app.health.status === 'Degraded' || app.health.status === 'Missing'
        ).length,
        synced: apps.filter((app) => app.sync.status === 'Synced').length,
        outOfSync: apps.filter((app) => app.sync.status === 'OutOfSync').length,
      };

      return { applications: apps, summary };
    } catch (error) {
      console.error('Error fetching ArgoCD data:', error);
      throw error;
    }
  }
}
