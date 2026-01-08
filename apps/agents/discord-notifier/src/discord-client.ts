import { Client, GatewayIntentBits, TextChannel, Message } from 'discord.js';

export class DiscordClient {
  private client: Client;
  private channelId: string;
  private isReady = false;

  constructor(token: string, channelId: string) {
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

  async sendMessage(content: string): Promise<void> {
    if (!this.isReady) {
      throw new Error('Discord client is not ready');
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (channel && channel.isTextBased()) {
        await (channel as TextChannel).send(content);
        console.log('✅ Message sent to Discord channel');
      } else {
        throw new Error('Channel not found or is not a text channel');
      }
    } catch (error) {
      console.error('Error sending Discord message:', error);
      throw error;
    }
  }

  onCommand(commandPrefix: string, callback: (message: Message) => void): void {
    this.client.on('messageCreate', (message) => {
      if (message.author.bot) return;
      if (message.content.startsWith(commandPrefix)) {
        callback(message);
      }
    });
  }

  async destroy(): Promise<void> {
    await this.client.destroy();
    this.isReady = false;
  }
}
