import { IRawRecordProcessor, RawRecordDto } from "@domains/catalog/record";
import { QueueChannel } from "../../infrastructure/queue-client";

type ScrapedApp = {
  name: string;
  slug: string;
  description: string;
  tags: string[];
  [key: string]: any;
};

export class RawRecordProcessorService implements IRawRecordProcessor {

  constructor(
    private readonly queue: QueueChannel,
    private readonly queueName: string
  ) { }

  processRawAppRecord(data: ScrapedApp): void {
    const rawRecord: RawRecordDto = {
      slug: data.slug,
      name: data.name,
      description: data.description || '',
      category: (data as any).category || '',
      tags: data.tags || [],
      platforms: (data as any).platforms || [],
    };

    const message = JSON.stringify(rawRecord);
    this.queue.sendToQueue(this.queueName, Buffer.from(message));
  }

  async initialize(): Promise<void> {
    await this.queue.assertQueue(this.queueName);
  }
}