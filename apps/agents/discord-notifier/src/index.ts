import dotenv from 'dotenv';
import { DiscordClient } from './discord-client';
import { GitHubClient } from './github-client';
import { ArgoCDClient } from './argocd-client';
import { RabbitMQClient } from './rabbitmq-client';
import { OpenAIClient } from './openai-client';
import { NoteGenerator } from './note-generator';
import { Scheduler } from './scheduler';
import { ChannelRegistry } from './channel-registry';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'DISCORD_BOT_TOKEN',
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
    process.env['DISCORD_CHANNEL_ID'] // Optional - only needed for scheduled updates
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

  // Initialize channel registry (optionally with initial channel from env)
  const storagePath = process.env['CHANNEL_REGISTRY_PATH'] || '/data/channels.json';
  const initialChannels = process.env['DISCORD_CHANNEL_ID'] ? [process.env['DISCORD_CHANNEL_ID']] : undefined;
  const channelRegistry = new ChannelRegistry(storagePath, initialChannels);

  // Setup command handler for on-demand requests
  discordClient.onCommand('!devstatus', async (message) => {
    console.log(`📨 Received !devstatus command from ${message.author.tag} in channel ${message.channel.id}`);
    
    try {
      await message.reply('🔄 Generating development status update...');
      const notes = await noteGenerator.generateDevNotes(24);
      // Send to the same channel where the command was issued
      await discordClient.sendMessage(notes, message.channel.id);
    } catch (error) {
      console.error('Error handling !devstatus command:', error);
      await message.reply('❌ Failed to generate dev status. Check the logs!');
    }
  });

  // Register channel for scheduled updates
  discordClient.onCommand('!register', async (message) => {
    const channelId = message.channel.id;
    const wasNew = channelRegistry.register(channelId);
    
    if (wasNew) {
      await message.reply(`✅ This channel is now registered for scheduled updates! (${channelRegistry.getCount()} total)`);
    } else {
      await message.reply(`ℹ️ This channel is already registered for scheduled updates.`);
    }
  });

  // Unregister channel from scheduled updates
  discordClient.onCommand('!unregister', async (message) => {
    const channelId = message.channel.id;
    const wasRemoved = channelRegistry.unregister(channelId);
    
    if (wasRemoved) {
      await message.reply(`✅ This channel is no longer receiving scheduled updates. (${channelRegistry.getCount()} remaining)`);
    } else {
      await message.reply(`ℹ️ This channel was not registered for scheduled updates.`);
    }
  });

  // List registered channels
  discordClient.onCommand('!channels', async (message) => {
    const channels = channelRegistry.getAll();
    const count = channelRegistry.getCount();
    
    if (count === 0) {
      await message.reply('📋 No channels are currently registered for scheduled updates.\nUse `!register` in a channel to add it.');
    } else {
      const channelList = channels.map((id) => `<#${id}>`).join(', ');
      await message.reply(`📋 **Registered channels (${count}):**\n${channelList}`);
    }
  });

  // Setup scheduler for periodic updates
  const scheduleTimes = process.env['SCHEDULE_TIMES']?.split(',') || ['09:00', '17:00'];
  const scheduler = new Scheduler();

  scheduler.scheduleDaily(scheduleTimes, async () => {
    const registeredChannels = channelRegistry.getAll();
    
    if (registeredChannels.length === 0) {
      console.log('⚠️ No channels registered for scheduled updates, skipping message send.');
      console.log('💡 Use !register command in Discord to register a channel for scheduled updates.');
      return;
    }

    try {
      console.log(`📊 Generating scheduled update for ${registeredChannels.length} channel(s)...`);
      const notes = await noteGenerator.generateDevNotes(24);
      await discordClient.sendToMultipleChannels(notes, registeredChannels);
    } catch (error) {
      console.error('Error in scheduled note generation:', error);
    }
  });

  scheduler.start();
  console.log(`📝 Scheduled updates at: ${scheduleTimes.join(', ')}`);
  const registeredCount = channelRegistry.getCount();
  console.log(`📋 Registered channels: ${registeredCount}`);
  if (registeredCount === 0) {
    console.log('⚠️  WARNING: No channels registered for scheduled updates!');
    console.log('💡 To register a channel, use the !register command in Discord, or set DISCORD_CHANNEL_ID environment variable.');
  }

  console.log('✅ Discord Notifier Bot is running!');
  console.log('💬 Commands:');
  console.log('   - !devstatus - Get on-demand development status update');
  console.log('   - !register - Register this channel for scheduled updates');
  console.log('   - !unregister - Unregister this channel from scheduled updates');
  console.log('   - !channels - List all registered channels');
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
