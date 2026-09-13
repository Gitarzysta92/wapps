export type GoogleAuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
};

export function buildGoogleAuthorizeUrl(params: GoogleAuthorizeParams): string {
  const { clientId, redirectUri, state, codeChallenge, codeChallengeMethod } = params;
  const search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  if (codeChallenge) search.set('code_challenge', codeChallenge);
  if (codeChallengeMethod) search.set('code_challenge_method', codeChallengeMethod);
  if (state) search.set('state', state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${search.toString()}`;
}

export type GithubAuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state?: string;
};

export function buildGithubAuthorizeUrl(params: GithubAuthorizeParams): string {
  const { clientId, redirectUri, state } = params;
  const search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'user:email',
  });
  if (state) search.set('state', state);
  return `https://github.com/login/oauth/authorize?${search.toString()}`;
}
