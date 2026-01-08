import { Octokit } from '@octokit/rest';

export interface GitHubData {
  commits: Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
  }>;
  workflows: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  pullRequests: Array<{
    number: number;
    title: string;
    state: string;
    author: string;
    createdAt: string;
  }>;
}

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, repoFullName: string) {
    this.octokit = new Octokit({ auth: token });
    const [owner, repo] = repoFullName.split('/');
    this.owner = owner;
    this.repo = repo;
  }

  async fetchRecentActivity(hoursBack = 24): Promise<GitHubData> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    try {
      // Fetch recent commits
      const commitsResponse = await this.octokit.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        since,
        per_page: 20,
      });

      const commits = commitsResponse.data.map((commit) => ({
        sha: commit.sha.substring(0, 7),
        message: commit.commit.message.split('\n')[0],
        author: commit.commit.author?.name || 'Unknown',
        date: commit.commit.author?.date || '',
      }));

      // Fetch recent workflow runs
      const workflowsResponse = await this.octokit.actions.listWorkflowRunsForRepo({
        owner: this.owner,
        repo: this.repo,
        per_page: 10,
      });

      const workflows = workflowsResponse.data.workflow_runs
        .filter((run) => new Date(run.created_at) > new Date(since))
        .map((run) => ({
          name: run.name || 'Unnamed workflow',
          status: run.status || 'unknown',
          conclusion: run.conclusion,
          createdAt: run.created_at,
          updatedAt: run.updated_at,
        }));

      // Fetch recent pull requests
      const prsResponse = await this.octokit.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 10,
      });

      const pullRequests = prsResponse.data
        .filter((pr) => new Date(pr.updated_at) > new Date(since))
        .map((pr) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user?.login || 'Unknown',
          createdAt: pr.created_at,
        }));

      return { commits, workflows, pullRequests };
    } catch (error) {
      console.error('Error fetching GitHub data:', error);
      throw error;
    }
  }
}
