import { Observable } from "rxjs";
import { Result } from "@foundation/standard";

export interface ISharingProvider {
  shareContent(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string, title: string, path?: string): Observable<Result<boolean, Error>>;
  copyContent(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string, path?: string): Observable<Result<boolean, Error>>;
  contentUrl(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string, path?: string): string;
  canShare(): boolean;
  canShareViaDevice(): boolean;
}



