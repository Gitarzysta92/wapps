# Discord Notifier Bot 🤖

A long-running Discord bot that gathers development information from GitHub, ArgoCD, and RabbitMQ, then uses ChatGPT to generate fun and informative development status updates.

## Features

- 🔄 **Automated Scheduled Updates**: Posts development status to Discord at configured times (default: 9 AM and 5 PM)
- 💬 **On-Demand Reports**: Use `!devstatus` command in Discord to get instant updates
- 🐙 **GitHub Integration**: Tracks commits, workflow runs, and pull requests
- 🚢 **ArgoCD Integration**: Monitors application health and deployment status
- 🐰 **RabbitMQ Integration**: Checks queue health and message backlogs
- 🤖 **AI-Powered**: Uses ChatGPT to generate witty and informative summaries

## Architecture

```
Discord Bot → [GitHub, ArgoCD, RabbitMQ] → Data Aggregation → ChatGPT → Discord Message
```

## Environment Variables

### Required
- `DISCORD_BOT_TOKEN` - Discord bot authentication token
- `DISCORD_CHANNEL_ID` - Discord channel ID for posting messages
- `GITHUB_TOKEN` - GitHub Personal Access Token with repo access
- `GITHUB_REPO` - Repository name (format: owner/repo)
- `ARGOCD_SERVER` - ArgoCD server URL
- `ARGOCD_TOKEN` - ArgoCD API token
- `OPENAI_API_KEY` - OpenAI API key for GPT
- `QUEUE_USERNAME` - RabbitMQ username
- `QUEUE_PASSWORD` - RabbitMQ password

### Optional
- `QUEUE_HOST` - RabbitMQ host (default: localhost)
- `QUEUE_PORT` - RabbitMQ port (default: 5672)
- `SCHEDULE_TIMES` - Comma-separated times for daily updates (default: "09:00,17:00")
- `TZ` - Timezone for scheduling (default: UTC)

## Development

### Local Development
```bash
# Install dependencies
npm install

# Run in watch mode
npx nx serve discord-notifier

# Build
npx nx build discord-notifier
```

### Testing the Bot
1. Create a Discord bot at https://discord.com/developers/applications
2. Add bot to your server with proper permissions
3. Set up environment variables in `.env` file
4. Run the bot locally

## Deployment

### Kubernetes
The bot is deployed as a Kubernetes Deployment:
- Namespace: `agents`
- Secrets managed by Vault
- Auto-deployed via ArgoCD

### GitHub Actions
The CI/CD pipeline:
1. Runs tests and linting
2. Builds Docker image
3. Pushes to GitHub Container Registry
4. Deploys via ArgoCD

## Discord Commands

- `!devstatus` - Generate and post current development status

## Customization

### Modifying the Prompt
Edit `src/constants.ts` to customize:
- `SYSTEM_PROMPT` - Bot personality and response style
- `USER_PROMPT_TEMPLATE` - Data structure sent to ChatGPT

### Schedule Times
Set `SCHEDULE_TIMES` environment variable:
```
SCHEDULE_TIMES=09:00,12:00,17:00,21:00
```

## Project Structure

```
apps/agents/discord-notifier/
├── src/
│   ├── index.ts              # Main entry point
│   ├── constants.ts          # Prompts and constants
│   ├── discord-client.ts     # Discord bot integration
│   ├── github-client.ts      # GitHub API client
│   ├── argocd-client.ts      # ArgoCD API client
│   ├── rabbitmq-client.ts    # RabbitMQ monitoring
│   ├── openai-client.ts      # ChatGPT integration
│   ├── note-generator.ts     # Data aggregation and note generation
│   ├── scheduler.ts          # Cron job scheduler
│   └── rabbitmq.ts           # RabbitMQ connection utils
├── provisioning/
│   ├── k8s/                  # Kubernetes manifests
│   └── vault/                # Vault configuration
├── Dockerfile
└── project.json
```
