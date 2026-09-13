import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Result } from '@foundation/standard';
import { Observable } from 'rxjs';
import { ISharingProvider } from '../application/sharing-provider.port';
import { SHARING_BASE_URL_PROVIDER } from '../application/infrastructure-providers.port';

@Injectable()
export class SharingApiService implements ISharingProvider {
  private readonly baseUrl = inject(SHARING_BASE_URL_PROVIDER);
  private readonly document = inject(DOCUMENT);

  contentUrl(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string, path?: string): string {
    const origin = this.document.defaultView?.location.origin;
    const base = new URL(origin && origin !== 'null' ? origin : this.baseUrl || this.document.baseURI, this.document.baseURI);
    const route = path || `/${type === 'applications' ? 'apps' : type}/${encodeURIComponent(slug)}`;
    const url = new URL(route, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== base.origin) {
      throw new Error('Only links within this portal can be shared.');
    }
    return url.href;
  }

  shareContent(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string, title: string, path?: string): Observable<Result<boolean, Error>> {
    return this.perform(() => {
      const url = this.contentUrl(type, slug, path);
      const navigator = this.document.defaultView?.navigator;
      return navigator?.share
        ? navigator.share({ title, url })
        : this.copyUrl(url);
    });
  }

  copyContent(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string, path?: string): Observable<Result<boolean, Error>> {
    return this.perform(() => this.copyUrl(this.contentUrl(type, slug, path)));
  }

  private copyUrl(url: string): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    return clipboard?.writeText
      ? clipboard.writeText(url)
      : Promise.reject(new Error('Clipboard access is unavailable. Select and copy the link.'));
  }

  private perform(operation: () => Promise<void>): Observable<Result<boolean, Error>> {
    return new Observable(observer => {
      const finish = (result: Result<boolean, Error>) => { observer.next(result); observer.complete(); };
      try {
        operation().then(() => finish({ ok: true, value: true })).catch((error: unknown) => {
          if (error instanceof Error && error.name === 'AbortError') finish({ ok: true, value: false });
          else finish({ ok: false, error: new Error('Could not share automatically. Copy the link below.') });
        });
      } catch (error) {
        finish({ ok: false, error: error instanceof Error ? error : new Error('Could not prepare this link.') });
      }
    });
  }

  canShare(): boolean {
    const navigator = this.document.defaultView?.navigator;
    return !!(navigator?.share || navigator?.clipboard?.writeText);
  }

  canShareViaDevice(): boolean {
    return typeof this.document.defaultView?.navigator.share === 'function';
  }
}
