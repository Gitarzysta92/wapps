# Vault Role Configuration for Discord Notifier

## Secret Path
`secret/discord-notifier`

## Required Secrets
- `DISCORD_BOT_TOKEN` - Discord bot authentication token
- `DISCORD_CHANNEL_ID` - Discord channel ID to post messages
- `GITHUB_TOKEN` - GitHub Personal Access Token with repo access
- `ARGOCD_TOKEN` - ArgoCD API token with read access
- `OPENAI_API_KEY` - OpenAI API key for GPT access

## Vault Policy Example
```hcl
path "secret/data/discord-notifier" {
  capabilities = ["read"]
}
```

## Creating the Secret in Vault
```bash
vault kv put secret/discord-notifier \
  DISCORD_BOT_TOKEN="your-discord-bot-token" \
  DISCORD_CHANNEL_ID="your-channel-id" \
  GITHUB_TOKEN="your-github-token" \
  ARGOCD_TOKEN="your-argocd-token" \
  OPENAI_API_KEY="your-openai-api-key"
```
