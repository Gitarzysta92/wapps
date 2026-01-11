import { RawRecordDto } from "../models/raw-record.dto";

export interface IRawRecordProcessor {
  processRawAppRecord(data: RawRecordDto): void;
}