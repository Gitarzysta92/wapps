import dotenv from 'dotenv';
import { DiscordClient } from './discord-client';
import { GitHubClient } from './github-client';
import { ArgoCDClient } from './argocd-client';
import { RabbitMQClient } from './rabbitmq-client';
import { OpenAIClient } from './openai-client';
import { NoteGenerator } from './note-generator';
import { Scheduler } from './scheduler';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CHANNEL_ID',
  'GITHUB_TOKEN',
  'GITHUB_REPO',
  'ARGOCD_SERVER',
  'ARGOCD_TOKEN',
  'OPENAI_API_KEY',
  'QUEUE_USERNAME',
  'QUEUE_PASSWORD',
];

function validateEnv(): void {
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((varName) => console.error(`  - ${varName}`));
    process.exit(1);
  }
}

async function run() {
  console.log('🚀 Starting Discord Notifier Bot...');
  
  validateEnv();

  // Initialize clients
  const discordClient = new DiscordClient(
    process.env['DISCORD_BOT_TOKEN']!,
    process.env['DISCORD_CHANNEL_ID']!
  );

  const githubClient = new GitHubClient(
    process.env['GITHUB_TOKEN']!,
    process.env['GITHUB_REPO']!
  );

  const argocdClient = new ArgoCDClient(
    process.env['ARGOCD_SERVER']!,
    process.env['ARGOCD_TOKEN']!
  );

  const rabbitmqClient = new RabbitMQClient();

  const openaiClient = new OpenAIClient(process.env['OPENAI_API_KEY']!);

  const noteGenerator = new NoteGenerator(
    githubClient,
    argocdClient,
    rabbitmqClient,
    openaiClient
  );

  // Wait for Discord to be ready
  await discordClient.waitForReady();
  console.log('✅ Discord bot is ready');

  // Setup command handler for on-demand requests
  discordClient.onCommand('!devstatus', async (message) => {
    console.log(`📨 Received !devstatus command from ${message.author.tag}`);
    
    try {
      await message.reply('🔄 Generating development status update...');
      const notes = await noteGenerator.generateDevNotes(24);
      await discordClient.sendMessage(notes);
    } catch (error) {
      console.error('Error handling !devstatus command:', error);
      await message.reply('❌ Failed to generate dev status. Check the logs!');
    }
  });

  // Setup scheduler for periodic updates
  const scheduleTimes = process.env['SCHEDULE_TIMES']?.split(',') || ['09:00', '17:00'];
  const scheduler = new Scheduler();

  scheduler.scheduleDaily(scheduleTimes, async () => {
    try {
      const notes = await noteGenerator.generateDevNotes(24);
      await discordClient.sendMessage(notes);
    } catch (error) {
      console.error('Error in scheduled note generation:', error);
    }
  });

  scheduler.start();

  console.log('✅ Discord Notifier Bot is running!');
  console.log(`📝 Scheduled updates at: ${scheduleTimes.join(', ')}`);
  console.log('💬 Use !devstatus in Discord for on-demand updates');
  console.log('🔌 GitHub repo:', process.env['GITHUB_REPO']);
  console.log('🚢 ArgoCD server:', process.env['ARGOCD_SERVER']);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    scheduler.stop();
    await discordClient.destroy();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    scheduler.stop();
    await discordClient.destroy();
    process.exit(0);
  });
}

run().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
