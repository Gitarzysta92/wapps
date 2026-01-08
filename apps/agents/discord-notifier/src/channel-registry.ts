import * as fs from 'fs';
import * as path from 'path';

export class ChannelRegistry {
  private registeredChannels: Set<string> = new Set();
  private storagePath: string;

  constructor(storagePath?: string, initialChannels?: string[]) {
    // Default to /data/channels.json if running in Kubernetes, otherwise ./channels.json
    this.storagePath = storagePath || process.env['CHANNEL_REGISTRY_PATH'] || '/data/channels.json';
    
    // Load from file if it exists
    this.load();
    
    // Add initial channels if provided
    if (initialChannels) {
      initialChannels.forEach((id) => this.register(id));
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        const channels = JSON.parse(data) as string[];
        channels.forEach((id) => this.registeredChannels.add(id));
        console.log(`📂 Loaded ${channels.length} registered channel(s) from ${this.storagePath}`);
      } else {
        console.log(`📂 No existing channel registry found at ${this.storagePath}, starting fresh`);
      }
    } catch (error) {
      console.error(`⚠️ Error loading channel registry from ${this.storagePath}:`, error);
      console.log('📝 Starting with empty registry');
    }
  }

  private save(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const channels = Array.from(this.registeredChannels);
      fs.writeFileSync(this.storagePath, JSON.stringify(channels, null, 2), 'utf-8');
      console.log(`💾 Saved ${channels.length} channel(s) to ${this.storagePath}`);
    } catch (error) {
      console.error(`⚠️ Error saving channel registry to ${this.storagePath}:`, error);
      // Don't throw - allow operation to continue even if save fails
    }
  }

  register(channelId: string): boolean {
    if (this.registeredChannels.has(channelId)) {
      return false; // Already registered
    }
    this.registeredChannels.add(channelId);
    this.save();
    console.log(`📝 Registered channel: ${channelId}`);
    return true;
  }

  unregister(channelId: string): boolean {
    const removed = this.registeredChannels.delete(channelId);
    if (removed) {
      this.save();
      console.log(`🗑️ Unregistered channel: ${channelId}`);
    }
    return removed;
  }

  isRegistered(channelId: string): boolean {
    return this.registeredChannels.has(channelId);
  }

  getAll(): string[] {
    return Array.from(this.registeredChannels);
  }

  getCount(): number {
    return this.registeredChannels.size;
  }

  clear(): void {
    this.registeredChannels.clear();
    this.save();
    console.log('🗑️ Cleared all registered channels');
  }
}
