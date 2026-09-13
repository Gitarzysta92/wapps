import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { ISharingProvider } from "./sharing-provider.port";
import { SHARING_PROVIDER } from "./sharing-provider.token";

@Injectable()
export class SharingService {
  private readonly _sharingProvider = inject<ISharingProvider>(SHARING_PROVIDER);

  public shareContent(
    type: 'applications' | 'suites' | 'articles' | 'discussions',
    slug: string,
    title: string,
    path?: string
  ): Observable<Result<boolean, Error>> {
    return this._sharingProvider.shareContent(type, slug, title, path);
  }

  public contentUrl(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string, path?: string): string {
    return this._sharingProvider.contentUrl(type, slug, path);
  }

  public copyContent(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string, path?: string): Observable<Result<boolean, Error>> {
    return this._sharingProvider.copyContent(type, slug, path);
  }

  public canShareViaDevice(): boolean {
    return this._sharingProvider.canShareViaDevice();
  }

  public canShare(): boolean {
    return this._sharingProvider.canShare();
  }
}



