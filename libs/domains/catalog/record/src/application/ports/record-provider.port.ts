import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { AppRecordDto } from "../models/record.dto";
import { AppPreviewDto } from "../models/record-preview.dto";

export interface IRecordsProvider {
  getRecord(slug: string): Observable<Result<AppRecordDto, Error>>;
  getRecordPreview(slug: string): Observable<Result<AppPreviewDto, Error>>;
}