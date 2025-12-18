import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { ISharingProvider } from "./sharing-provider.port";
import { SHARING_PROVIDER } from "./sharing-provider.token";

@Injectable()
export class SharingService {
  private readonly _sharingProvider = inject<ISharingProvider>(SHARING_PROVIDER);

  public shareContent(
    type: 'applications' | 'suites' | 'articles' | 'discussions',
    slug: string,
    title: string
  ): Observable<Result<boolean, Error>> {
    return this._sharingProvider.shareContent(type, slug, title);
  }

  public canShare(): boolean {
    return this._sharingProvider.canShare();
  }
}


