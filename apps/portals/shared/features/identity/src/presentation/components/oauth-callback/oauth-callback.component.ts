import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WA_LOCAL_STORAGE, WA_WINDOW } from '@ng-web-apis/common';
import { firstValueFrom } from 'rxjs';
import { AUTH_BFF_URL } from '../../../infrastructure/bff/auth-bff-url.token';
import { AuthenticationStorage } from '../../../infrastructure/authentication.storage';

/**
 * OAuth callback component
 * This component handles the OAuth redirect from providers.
 * It extracts the authorization code and posts it back to the opener window.
 */
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
  styles: [`
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
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `],
  standalone: true
})
export class OAuthCallbackComponent implements OnInit {
  private readonly _window = inject(WA_WINDOW);
  private readonly _http = inject(HttpClient);
  private readonly _authBffUrl = inject(AUTH_BFF_URL, { optional: true });
  private readonly _tokenStorage = inject(AuthenticationStorage, { optional: true });
  private readonly _localStorage = inject(WA_LOCAL_STORAGE);

  public errorText: string | null = null;

  public goHome(): void {
    this._window.location.href = '/';
  }

  ngOnInit(): void {
    // Get query parameters
    const params = new URLSearchParams(this._window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    // Always broadcast the callback payload as a fallback for COOP (window.opener can be severed).
    this._broadcastCallback({
      type: 'oauth_callback',
      code,
      state,
      error: error || errorDescription,
    });

    // Post message back to opener
    if (this._window.opener) {
      this._window.opener.postMessage({
        type: 'oauth_callback',
        code,
        state,
        error: error || errorDescription
      }, this._window.location.origin);
      
      // Close this window after a short delay
      setTimeout(() => {
        try {
          this._window.close();
        } catch {
          // ignore
        }
      }, 100);
      return;
    } else {
      // No opener: complete sign-in in the current window (redirect-based fallback)
      void this._completeInSameWindow(code, state, error || errorDescription);
    }
  }

  private async _completeInSameWindow(code: string | null, returnedState: string | null, error: string | null) {
    try {
      if (error) {
        this._fail(`OAuth error: ${error}`);
        return;
      }

      const savedState = sessionStorage.getItem('oauth_state');
      let provider = sessionStorage.getItem('oauth_provider');
      let redirectUri = sessionStorage.getItem('oauth_redirect_uri') ?? `${this._window.location.origin}/auth/callback`;
      let returnTo: string | undefined;
      let codeVerifier: string | undefined;

      // Always try to read context from localStorage keyed by `state`.
      // Even in same-tab redirects, PKCE `codeVerifier` is stored there.
      if (returnedState) {
        try {
          const raw = this._localStorage.getItem(`oauth_ctx_${returnedState}`);
          const ctx = raw ? JSON.parse(raw) : undefined;
          provider = provider || ctx?.provider;
          redirectUri = ctx?.redirectUri || redirectUri;
          returnTo = ctx?.returnTo || returnTo;
          codeVerifier = ctx?.codeVerifier || codeVerifier;
        } catch {
          // ignore
        } finally {
          // best-effort cleanup
          try {
            this._localStorage.removeItem(`oauth_ctx_${returnedState}`);
          } catch {
            // ignore
          }
        }
      }

      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_provider');
      sessionStorage.removeItem('oauth_redirect_uri');

      if (!code || !provider) {
        this._fail('OAuth callback missing code or provider');
        return;
      }

      if (savedState) {
        if (returnedState !== savedState) {
          this._fail('Invalid OAuth state');
          return;
        }
      } else if (!returnedState) {
        this._fail('Invalid OAuth state');
        return;
      }

      if (!this._authBffUrl || !this._tokenStorage) {
        this._fail('Auth BFF not configured in this app');
        return;
      }

      const response = await firstValueFrom(
        this._http.post<{ token: string; refreshToken: string }>(
          `${this._authBffUrl}/auth/signin/oauth`,
          { provider, code, redirectUri, codeVerifier }
        )
      );

      // Keep behavior consistent with BffAuthenticationService
      this._localStorage.setItem('auth_refresh_token', response.refreshToken);
      this._tokenStorage.setToken(response.token);
      // Trigger cross-window listeners (storage event)
      this._localStorage.setItem('oauth_completed_at', String(Date.now()));

      // If this is the named OAuth popup/tab, close it after success.
      // Otherwise (redirect), navigate back to returnTo if present.
      if (this._window.name === 'oauth_popup') {
        setTimeout(() => {
          try {
            this._window.close();
          } catch {
            // ignore
          }
        }, 150);
      } else {
        this._window.location.href = returnTo || '/';
      }
    } catch (e: any) {
      const backendMsg = e?.error?.error;
      const msg =
        (typeof backendMsg === 'string' && backendMsg) ||
        (typeof e?.message === 'string' && e.message) ||
        'OAuth sign-in failed';
      this._fail(msg);
    }
  }

  private _fail(message: string) {
    try {
      this._localStorage.setItem('oauth_last_error', message);
    } catch {
      // ignore
    }
    this.errorText = message;
  }

  private _broadcastCallback(payload: { type: 'oauth_callback'; code: string | null; state: string | null; error: string | null }) {
    try {
      // BroadcastChannel
      const BC = (this._window as any).BroadcastChannel;
      if (BC) {
        const ch = new BC('wapps_oauth');
        ch.postMessage(payload);
        ch.close();
      }
    } catch {
      // ignore
    }

    try {
      // localStorage storage-event broadcast (include nonce so it always fires)
      const nonce = Math.random().toString(16).slice(2);
      this._localStorage.setItem('oauth_callback', JSON.stringify({ ...payload, nonce }));
    } catch {
      // ignore
    }
  }
}

