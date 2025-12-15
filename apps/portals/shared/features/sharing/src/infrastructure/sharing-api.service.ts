import { inject, Injectable } from "@angular/core";
import { Result } from "@standard";
import { Observable, of } from "rxjs";
import { ISharingProvider } from "../application/sharing-provider.port";
import { SHARING_BASE_URL_PROVIDER } from "../application/infrastructure-providers.port";

@Injectable()
export class SharingApiService implements ISharingProvider {
  private readonly _baseUrl = inject(SHARING_BASE_URL_PROVIDER);

  public shareContent(
    type: 'applications' | 'suites' | 'articles' | 'discussions',
    slug: string,
    title: string
  ): Observable<Result<boolean, Error>> {
    // Check if Web Share API is available
    if (this.canShare() && navigator.share) {
      const url = `${this._baseUrl}/${type}/${slug}`;
      
      return new Observable(observer => {
        navigator.share({
          title: title,
          text: `Check out this ${type.slice(0, -1)}: ${title}`,
          url: url
        })
        .then(() => {
          observer.next({ ok: true, value: true });
          observer.complete();
        })
        .catch((error) => {
          // User cancelled or error occurred
          if (error.name === 'AbortError') {
            // User cancelled, treat as success
            observer.next({ ok: true, value: false });
          } else {
            observer.next({ ok: false, error: error as Error });
          }
          observer.complete();
        });
      });
    } else {
      // Fallback: Copy to clipboard
      const url = `${this._baseUrl}/${type}/${slug}`;
      return new Observable(observer => {
        navigator.clipboard.writeText(url)
          .then(() => {
            console.log(`Copied link to clipboard: ${url}`);
            observer.next({ ok: true, value: true });
            observer.complete();
          })
          .catch((error) => {
            observer.next({ ok: false, error: error as Error });
            observer.complete();
          });
      });
    }
  }

  public canShare(): boolean {
    return typeof navigator !== 'undefined' && 
           (!!navigator.share || !!navigator.clipboard);
  }
}
