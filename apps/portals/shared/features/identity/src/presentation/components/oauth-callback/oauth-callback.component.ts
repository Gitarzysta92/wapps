import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OAUTH_CALLBACK_HANDLER } from '../../../application/oauth-callback.port';

@Component({
  selector: 'oauth-callback',
  template: `
    <div class="callback-container">
      @if (errorText) {
      <h2>Sign-in failed</h2>
      <p class="error">{{ errorText }}</p>
      <button class="btn" type="button" (click)="goHome()">Go back</button>
      } @else {
      <div class="spinner"></div>
      <p>Completing sign-in...</p>
      }
    </div>
  `,
  styles: [
    `
      .callback-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: system-ui, -apple-system, sans-serif;
        padding: 1.5rem;
        text-align: center;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
      }

      .error {
        max-width: 44rem;
        white-space: pre-wrap;
        word-break: break-word;
        color: #b00020;
        margin: 0.5rem 0 1rem;
      }

      .btn {
        appearance: none;
        border: 1px solid #ccc;
        background: white;
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
  standalone: true,
})
export class OAuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly handler = inject(OAUTH_CALLBACK_HANDLER);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changes = inject(ChangeDetectorRef);
  public errorText: string | null = null;

  goHome(): void {
    void this.router.navigateByUrl('/');
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.location.replaceState('/auth/callback');
    if (
      params.getAll('state').length !== 1 ||
      params.getAll('code').length > 1
    ) {
      this.errorText = 'Invalid OAuth callback. Please sign in again.';
      return;
    }
    this.handler
      .completeCallback({
        code: params.get('code'),
        state: params.get('state'),
        error: params.get('error'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.ok) void this.router.navigateByUrl(result.value);
          else this.errorText = result.error.message;
          this.changes.markForCheck();
        },
        error: () => {
          this.errorText =
            'Sign-in could not be completed. Please start again.';
          this.changes.markForCheck();
        },
      });
  }
}
