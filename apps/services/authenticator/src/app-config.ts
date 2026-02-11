export type AuthenticatorAppConfig = {
  ingressAuthSecret: string | undefined;
  firebaseProjectId: string | undefined;
  firebaseWebApiKey: string | undefined;

  oauth: {
    enableGoogle: boolean;
    googleClientId: string | undefined;
    googleClientSecret: string | undefined;
    enableGithub: boolean;
    githubClientId: string | undefined;
    githubClientSecret: string | undefined;
  };

  providers: {
    enableEmailPassword: boolean;
    enableGoogle: boolean;
    enableGithub: boolean;
    enableAnonymous: boolean;
  };
};

function validateConfig(config: AuthenticatorAppConfig): void {
  const missing: string[] = [];

  if (config.providers.enableEmailPassword && !config.firebaseWebApiKey) {
    missing.push('FIREBASE_WEB_API_KEY (required when email/password is enabled)');
  }
  if (config.oauth.enableGoogle) {
    if (!config.oauth.googleClientId) missing.push('GOOGLE_CLIENT_ID');
    if (!config.oauth.googleClientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  }
  if (config.oauth.enableGithub) {
    if (!config.oauth.githubClientId) missing.push('GITHUB_CLIENT_ID');
    if (!config.oauth.githubClientSecret) missing.push('GITHUB_CLIENT_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(
      `Authenticator startup failed: missing required env: ${missing.join(', ')}. Set them or disable the corresponding provider.`
    );
  }
}

export function readConfigFromEnv(): AuthenticatorAppConfig {
  const config: AuthenticatorAppConfig = {
    ingressAuthSecret: process.env.INGRESS_AUTH_SECRET,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseWebApiKey: process.env.FIREBASE_WEB_API_KEY,
    oauth: {
      enableGoogle: process.env.ENABLE_GOOGLE === 'true',
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
      enableGithub: process.env.ENABLE_GITHUB === 'true',
      githubClientId: process.env.GITHUB_CLIENT_ID,
      githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    providers: {
      enableEmailPassword: process.env.ENABLE_EMAIL_PASSWORD !== 'false',
      enableGoogle: process.env.ENABLE_GOOGLE === 'true',
      enableGithub: process.env.ENABLE_GITHUB === 'true',
      enableAnonymous: process.env.ENABLE_ANONYMOUS === 'true',
    },
  };
  validateConfig(config);
  return config;
}

