import { Observable } from "rxjs";
import { Result } from "@standard";

export interface ISharingProvider {
  shareContent(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string, title: string): Observable<Result<boolean, Error>>;
  canShare(): boolean;
}


