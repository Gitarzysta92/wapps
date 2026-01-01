import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { WA_WINDOW } from '@ng-web-apis/common';

/**
 * OAuth callback component
 * This component handles the OAuth redirect from providers.
 * It extracts the authorization code and posts it back to the opener window.
 */
@Component({
  selector: 'oauth-callback',
  template: `
    <div class="callback-container">
      <div class="spinner"></div>
      <p>Completing sign-in...</p>
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
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `],
  standalone: true
})
export class OAuthCallbackComponent implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _window = inject(WA_WINDOW);

  ngOnInit(): void {
    // Get query parameters
    const params = new URLSearchParams(this._window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

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
        this._window.close();
      }, 100);
    } else {
      // If no opener, redirect to home (fallback)
      console.error('No opener window found');
      this._window.location.href = '/';
    }
  }
}

