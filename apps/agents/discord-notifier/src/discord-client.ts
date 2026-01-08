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

  /**
   * Splits content into chunks that fit within Discord's 2000 character limit.
   * Tries to split at section boundaries (double newlines) when possible.
   */
  private splitIntoChunks(content: string, maxLength = 2000): string[] {
    if (content.length <= maxLength) {
      return [content];
    }

    const chunks: string[] = [];
    let remaining = content;

    while (remaining.length > maxLength) {
      // Try to split at a section boundary (double newline)
      const sectionBoundary = remaining.lastIndexOf('\n\n', maxLength);
      // Fallback: try to split at a single newline
      const lineBoundary = remaining.lastIndexOf('\n', maxLength);
      // Last resort: split at word boundary (space)
      const wordBoundary = remaining.lastIndexOf(' ', maxLength);

      let splitIndex = -1;
      if (sectionBoundary > maxLength * 0.5) {
        // Prefer section boundary if it's not too early
        splitIndex = sectionBoundary + 2; // Include the double newline
      } else if (lineBoundary > maxLength * 0.7) {
        // Prefer line boundary if it's reasonably close to the limit
        splitIndex = lineBoundary + 1; // Include the newline
      } else if (wordBoundary > maxLength * 0.8) {
        // Use word boundary as last resort
        splitIndex = wordBoundary + 1; // Include the space
      } else {
        // Force split at maxLength if no good boundary found
        splitIndex = maxLength;
      }

      const chunk = remaining.substring(0, splitIndex);
      chunks.push(chunk);
      remaining = remaining.substring(splitIndex);
    }

    // Add the remaining content
    if (remaining.length > 0) {
      chunks.push(remaining);
    }

    return chunks;
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
      if (!channel || !channel.isTextBased()) {
        throw new Error('Channel not found or is not a text channel');
      }

      const textChannel = channel as TextChannel;
      const chunks = this.splitIntoChunks(content);

      // Send each chunk as a separate message
      for (let i = 0; i < chunks.length; i++) {
        await textChannel.send(chunks[i]);
        console.log(`✅ Message chunk ${i + 1}/${chunks.length} sent to Discord channel ${targetChannelId}`);
        
        // Add a small delay between messages to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
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
