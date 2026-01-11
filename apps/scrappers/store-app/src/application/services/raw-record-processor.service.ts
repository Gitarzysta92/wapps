import { IRawRecordProcessor, RawRecordDto } from "@domains/catalog/record";

export class RawRecordProcessorService implements IRawRecordProcessor {
  constructor(private readonly queue: QueueClient) {
  }
  processRawAppRecord(data: RawRecordDto): void {
    throw new Error("Method not implemented.");
  }
}