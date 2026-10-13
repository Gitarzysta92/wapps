import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, switchMap, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import { parseApplicationDraftReceipt } from '@domains/catalog/record';
import {
  APPLICATION_IMAGE_RETAINED_LIMIT,
  APPLICATION_IMAGE_SOURCE_LIMIT,
  APPLICATION_IMAGE_OUTPUT_LIMIT,
  applicationImageId,
  applicationImageInteger,
  applicationImagePurpose,
  parseApplicationImageSource,
  parseApplicationImageUpload,
  parseApplicationImageUploadReceipt,
  type ApplicationImageAsset,
  type ApplicationImageUploadInput,
  type ApplicationImageChange,
} from '@domains/catalog/media';
import {
  APPLICATION_WORKSPACE_ORIGIN,
  ApplicationDraftRequestError,
} from '../application/application-drafts.port';
import type {
  ApplicationMediaPort,
  ApplicationMediaPreview,
} from '../application/application-media.port';

@Injectable({ providedIn: 'root' })
export class ApplicationMediaApiService implements ApplicationMediaPort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(APPLICATION_WORKSPACE_ORIGIN);
  private readonly images = this.origin + '/api/me/application-images';
  private readonly drafts = this.origin + '/api/me/application-drafts';
  inspect(file: File) {
    return defer(async () => {
      if (
        !file.size ||
        file.size > APPLICATION_IMAGE_SOURCE_LIMIT ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      )
        throw new Error('Choose a PNG, JPEG or WebP image of at most 8 MiB.');
      const hash = await crypto.subtle.digest(
        'SHA-256',
        await file.arrayBuffer()
      );
      return parseApplicationImageSource({
        contentType: file.type,
        bytes: file.size,
        sha256: Array.from(new Uint8Array(hash), (value) =>
          value.toString(16).padStart(2, '0')
        ).join(''),
      });
    }).pipe(
      map(ok),
      catchError((error: unknown) =>
        of(
          err(
            error instanceof Error
              ? error
              : new Error('The image could not be read. Select the file again.')
          )
        )
      )
    );
  }
  list(draftId: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(this.images, {
          params: { draftId: applicationImageId(draftId) },
        })
      ).pipe(
        map((value) => {
          if (
            !Array.isArray(value) ||
            value.length > APPLICATION_IMAGE_RETAINED_LIMIT
          )
            throw new Error('Invalid upload list');
          const uploads = value.map(parseApplicationImageUpload);
          if (
            uploads.some(
              (upload) =>
                upload.draftId !== draftId || upload.status === 'cancelled'
            ) ||
            new Set(uploads.map((item) => item.id)).size !== uploads.length
          )
            throw new Error('Unexpected upload list');
          return uploads;
        })
      )
    );
  }
  reserve(input: ApplicationImageUploadInput, key: string) {
    return this.receipt(
      this.http.post<unknown>(this.images, input, {
        headers: { 'Idempotency-Key': key },
      }),
      null,
      1,
      'pending'
    );
  }
  read(id: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(`${this.images}/${applicationImageId(id)}`)
      ).pipe(
        map((value) => {
          const upload = parseApplicationImageUpload(value);
          if (upload.id !== id) throw new Error('Unexpected image identity');
          return upload;
        })
      )
    );
  }
  upload(id: string, revision: number, file: File, key: string) {
    return this.receipt(
      defer(() =>
        this.http.put<unknown>(
          `${this.images}/${applicationImageId(id)}/content`,
          file,
          {
            headers: {
              'Idempotency-Key': key,
              'If-Match': `"${applicationImageInteger(revision)}"`,
              'Content-Type': 'application/octet-stream',
            },
          }
        )
      ),
      id,
      revision + 1,
      'ready'
    );
  }
  cancel(id: string, revision: number, key: string) {
    return this.receipt(
      defer(() =>
        this.http.delete<unknown>(`${this.images}/${applicationImageId(id)}`, {
          body: { expectedRevision: revision },
          headers: { 'Idempotency-Key': key },
        })
      ),
      id,
      revision + 1,
      'cancelled'
    );
  }
  attach(draftId: string, input: ApplicationImageChange, key: string) {
    return this.result(
      defer(() =>
        this.http.put<unknown>(
          `${this.drafts}/${applicationImageId(draftId)}/images`,
          input,
          { headers: { 'Idempotency-Key': key } }
        )
      ).pipe(
        map((value) => {
          const receipt = parseApplicationDraftReceipt(value);
          if (
            receipt.id !== draftId ||
            receipt.deleted ||
            receipt.revision !== input.expectedRevision + 1
          )
            throw new Error('Unexpected image attachment receipt');
          return receipt;
        })
      ),
      true
    );
  }
  preview(target: ApplicationMediaPreview, asset: ApplicationImageAsset) {
    return this.result(
      defer(() => {
        const id = applicationImageId(target.id);
        let url: string;
        if (target.kind === 'upload') url = `${this.images}/${id}/content`;
        else {
          const purpose = applicationImagePurpose(target.purpose);
          url =
            target.kind === 'submission'
              ? `${
                  target.review
                    ? this.origin + '/api/editorial/application-reviews'
                    : this.drafts
                }/${id}/submissions/${applicationImageInteger(
                  target.revision
                )}/images/${purpose}/content`
              : `${this.drafts}/${
                  target.kind === 'canonical' ? 'canonical/' : ''
                }${id}/images/${purpose}/content`;
        }
        return this.http.get(url, { responseType: 'blob' });
      }).pipe(
        switchMap((blob) =>
          defer(async () => {
            if (
              blob.type !== 'image/webp' ||
              blob.size < 1 ||
              blob.size > APPLICATION_IMAGE_OUTPUT_LIMIT ||
              blob.size !== asset.bytes
            )
              throw new Error('Invalid preview bytes');
            const digest = await crypto.subtle.digest(
              'SHA-256',
              await blob.arrayBuffer()
            );
            if (
              Array.from(new Uint8Array(digest), (value) =>
                value.toString(16).padStart(2, '0')
              ).join('') !== asset.sha256
            )
              throw new Error('Image reference changed while loading');
            return blob;
          })
        )
      )
    );
  }
  private receipt(
    source: Observable<unknown>,
    id: string | null,
    revision: number,
    status: 'pending' | 'ready' | 'cancelled'
  ) {
    return this.result(
      source.pipe(
        map((value) => {
          const receipt = parseApplicationImageUploadReceipt(value);
          if (
            (id && receipt.id !== id) ||
            receipt.revision !== revision ||
            receipt.status !== status
          )
            throw new Error('Unexpected upload receipt');
          return receipt;
        })
      ),
      true
    );
  }
  private result<T>(
    source: Observable<T>,
    mutation = false
  ): Observable<Result<T, Error>> {
    return source.pipe(
      map(ok),
      catchError((error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const uncertain =
          mutation &&
          ![400, 401, 403, 404, 409, 413, 415, 422, 429].includes(status);
        const message =
          status === 409
            ? 'The draft or image changed, or this image is still referenced. Reload its current state before continuing.'
            : status === 404
            ? 'This draft or image is no longer available to this account.'
            : [401, 403].includes(status)
            ? 'Sign in again to access application images.'
            : status === 429
            ? 'The image upload or retry limit was reached. Cancel unused uploads or try again later.'
            : [400, 413, 415, 422].includes(status)
            ? 'Choose the exact reserved PNG, JPEG or WebP still image, up to 8 MiB and 20 million pixels. Reload an expired reservation.'
            : uncertain
            ? 'The image change could not be confirmed. Retry the same request.'
            : 'Application images are unavailable. Try again.';
        return of(
          err(new ApplicationDraftRequestError(uncertain, message, status))
        );
      })
    );
  }
}
