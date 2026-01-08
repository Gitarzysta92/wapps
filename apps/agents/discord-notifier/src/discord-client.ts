import { Client, GatewayIntentBits, TextChannel, Message } from 'discord.js';

export class DiscordClient {
  private client: Client;
  private channelId: string | undefined;
  private isReady = false;

  constructor(token: string, channelId?: string) {
    this.channelId = channelId;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.client.once('ready', () => {
      console.log(`✅ Discord bot logged in as ${this.client.user?.tag}`);
      this.isReady = true;
    });

    this.client.login(token);
  }

  async waitForReady(timeoutMs = 10000): Promise<void> {
    const startTime = Date.now();
    while (!this.isReady) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Discord client failed to become ready within timeout');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async sendMessage(content: string, channelId?: string): Promise<void> {
    if (!this.isReady) {
      throw new Error('Discord client is not ready');
    }

    const targetChannelId = channelId || this.channelId;
    if (!targetChannelId) {
      throw new Error('No channel ID provided and DISCORD_CHANNEL_ID not set');
    }

    try {
      const channel = await this.client.channels.fetch(targetChannelId);
      if (channel && channel.isTextBased()) {
        await (channel as TextChannel).send(content);
        console.log(`✅ Message sent to Discord channel ${targetChannelId}`);
      } else {
        throw new Error('Channel not found or is not a text channel');
      }
    } catch (error) {
      console.error(`Error sending Discord message to ${targetChannelId}:`, error);
      throw error;
    }
  }

  async sendToMultipleChannels(content: string, channelIds: string[]): Promise<void> {
    if (!this.isReady) {
      throw new Error('Discord client is not ready');
    }

    const results = await Promise.allSettled(
      channelIds.map((channelId) => this.sendMessage(content, channelId))
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    if (failed > 0) {
      console.warn(`⚠️ Failed to send to ${failed} out of ${channelIds.length} channels`);
    }

    console.log(`✅ Sent message to ${successful}/${channelIds.length} channels`);
  }

  onCommand(commandPrefix: string, callback: (message: Message) => void): void {
    this.client.on('messageCreate', (message) => {
      // Debug: log all messages (can be removed later)
      if (!message.author.bot) {
        console.log(`📩 Message received: "${message.content}" from ${message.author.tag} in ${message.channel.id}`);
      }
      
      if (message.author.bot) return;
      if (message.content.startsWith(commandPrefix)) {
        console.log(`✅ Command matched: ${commandPrefix}`);
        callback(message);
      }
    });
    
    // Also listen for errors
    this.client.on('error', (error) => {
      console.error('❌ Discord client error:', error);
    });
    
    this.client.on('warn', (warning) => {
      console.warn('⚠️ Discord client warning:', warning);
    });
  }

  async destroy(): Promise<void> {
    await this.client.destroy();
    this.isReady = false;
  }
}
