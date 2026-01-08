import { GitHubClient, GitHubData } from './github-client';
import { ArgoCDClient, ArgoCDData } from './argocd-client';
import { RabbitMQClient, RabbitMQData } from './rabbitmq-client';
import { OpenAIClient } from './openai-client';
import { USER_PROMPT_TEMPLATE } from './constants';

export class NoteGenerator {
  constructor(
    private githubClient: GitHubClient,
    private argocdClient: ArgoCDClient,
    private rabbitmqClient: RabbitMQClient,
    private openaiClient: OpenAIClient
  ) {}

  async generateDevNotes(hoursBack = 24): Promise<string> {
    console.log('📊 Gathering development data...');

    // Fetch data from all sources in parallel
    const [githubData, argocdData, rabbitmqData] = await Promise.all([
      this.fetchGitHubData(hoursBack),
      this.fetchArgoCDData(),
      this.fetchRabbitMQData(),
    ]);

    console.log('✅ Data gathered, generating notes...');

    // Format data for the prompt
    const prompt = this.formatPrompt(githubData, argocdData, rabbitmqData);

    // Generate notes using OpenAI
    const notes = await this.openaiClient.generateNotes(prompt);

    console.log('✅ Notes generated successfully');
    return notes;
  }

  private async fetchGitHubData(hoursBack: number): Promise<GitHubData> {
    try {
      return await this.githubClient.fetchRecentActivity(hoursBack);
    } catch (error) {
      console.error('Failed to fetch GitHub data:', error);
      return { commits: [], workflows: [], pullRequests: [] };
    }
  }

  private async fetchArgoCDData(): Promise<ArgoCDData> {
    try {
      return await this.argocdClient.fetchApplicationsStatus();
    } catch (error) {
      console.error('Failed to fetch ArgoCD data:', error);
      return {
        applications: [],
        summary: { total: 0, healthy: 0, degraded: 0, synced: 0, outOfSync: 0 },
      };
    }
  }

  private async fetchRabbitMQData(): Promise<RabbitMQData> {
    try {
      return await this.rabbitmqClient.fetchQueueStats();
    } catch (error) {
      console.error('Failed to fetch RabbitMQ data:', error);
      return {
        queues: [],
        summary: { totalQueues: 0, totalMessages: 0, queuesWithBacklog: 0 },
      };
    }
  }

  private formatPrompt(
    githubData: GitHubData,
    argocdData: ArgoCDData,
    rabbitmqData: RabbitMQData
  ): string {
    const githubSection = `
**Commits (${githubData.commits.length}):**
${githubData.commits.map((c) => `- ${c.sha}: ${c.message} (by ${c.author})`).join('\n') || 'No recent commits'}

**Workflows (${githubData.workflows.length}):**
${githubData.workflows.map((w) => `- ${w.name}: ${w.status} ${w.conclusion ? `(${w.conclusion})` : ''}`).join('\n') || 'No recent workflow runs'}

**Pull Requests (${githubData.pullRequests.length}):**
${githubData.pullRequests.map((pr) => `- #${pr.number}: ${pr.title} (${pr.state}, by ${pr.author})`).join('\n') || 'No recent pull requests'}
`;

    const argocdSection = `
**Summary:**
- Total Applications: ${argocdData.summary.total}
- Healthy: ${argocdData.summary.healthy}
- Degraded: ${argocdData.summary.degraded}
- Synced: ${argocdData.summary.synced}
- Out of Sync: ${argocdData.summary.outOfSync}

**Applications:**
${argocdData.applications.map((app) => `- ${app.name}: Health=${app.health.status}, Sync=${app.sync.status}`).join('\n') || 'No applications found'}
`;

    const rabbitmqSection = `
**Summary:**
- Total Queues: ${rabbitmqData.summary.totalQueues}
- Total Messages: ${rabbitmqData.summary.totalMessages}
- Queues with Backlog (>100): ${rabbitmqData.summary.queuesWithBacklog}

**Queue Details:**
${rabbitmqData.queues.map((q) => `- ${q.name}: ${q.messages} messages, ${q.consumers} consumers`).join('\n') || 'No queues monitored'}
`;

    return USER_PROMPT_TEMPLATE.replace('{{GITHUB_DATA}}', githubSection)
      .replace('{{ARGOCD_DATA}}', argocdSection)
      .replace('{{RABBITMQ_DATA}}', rabbitmqSection)
      .replace('{{TIMESTAMP}}', new Date().toISOString());
  }
}
