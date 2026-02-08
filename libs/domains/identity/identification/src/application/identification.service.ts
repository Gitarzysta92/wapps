import { err, isErr, ok, Result } from '@foundation/standard';
import { AuthSessionDto } from './models/auth-session.dto';
import { OAuthProvider } from './models/oauth-provider.type';
import { PrincipalDto } from './models/principal.dto';
import { TokenValidationResultDto } from './models/token-validation-result.dto';
import { IIdTokenVerifier } from './ports/id-token-verifier.port';
import { IIdentityGraphProvisioner } from './ports/identity-graph-provisioner.port';
import { IOAuthCodeExchanger } from './ports/oauth-code-exchanger.port';
import { ISessionGateway } from './ports/session-gateway.port';
import { IUserProvisioner } from './ports/user-provisioner.port';
import { AuthenticationMethodDto, AuthenticationProvider } from '@domains/identity/authentication';

export type IdentificationServiceConfig = {
  enabledEmailPassword: boolean;
  enabledGoogle: boolean;
  enabledGithub: boolean;
  enabledAnonymous: boolean;

  googleClientId?: string;
  googleClientSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  firebaseWebApiKey?: string;
};

type ErrorWithCode = Error & { code?: string };

function getErrorCode(e: unknown): string | undefined {
  if (!e || typeof e !== 'object') return undefined;
  const code = (e as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function mapFirebaseError(errorCode: string | undefined): string {
  const errorMessages: Record<string, string> = {
    EMAIL_NOT_FOUND: 'No account found with this email',
    INVALID_PASSWORD: 'Incorrect password',
    INVALID_LOGIN_CREDENTIALS: 'Invalid email or password',
    USER_DISABLED: 'This account has been disabled',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many failed attempts. Please try again later',
    EMAIL_EXISTS: 'An account with this email already exists',
    WEAK_PASSWORD: 'Password should be at least 6 characters',
    INVALID_EMAIL: 'Invalid email address',
  };

  return (errorCode && errorMessages[errorCode]) || 'Authentication failed. Please try again';
}

export class IdentificationService {
  constructor(
    private readonly idTokenVerifier: IIdTokenVerifier,
    private readonly sessionGateway: ISessionGateway,
    private readonly userProvisioner: IUserProvisioner,
    private readonly oauthCodeExchanger: IOAuthCodeExchanger,
    private readonly config: IdentificationServiceConfig,
    private readonly identityGraphProvisioner?: () => IIdentityGraphProvisioner | undefined
  ) {}

  getAvailableMethods(): AuthenticationMethodDto[] {
    const methods: AuthenticationMethodDto[] = [];

    if (this.config.enabledEmailPassword) {
      methods.push({
        provider: AuthenticationProvider.EMAIL_PASSWORD,
        displayName: 'Email & Password',
        icon: 'mail',
        enabled: true,
      });
    }

    if (this.config.enabledGoogle && this.config.googleClientId && this.config.googleClientSecret) {
      methods.push({
        provider: AuthenticationProvider.GOOGLE,
        displayName: 'Google',
        icon: 'google',
        enabled: true,
        authUrl: '/auth/oauth/google/authorize',
      });
    }

    if (this.config.enabledGithub && this.config.githubClientId && this.config.githubClientSecret) {
      methods.push({
        provider: AuthenticationProvider.GITHUB,
        displayName: 'GitHub',
        icon: 'github',
        enabled: true,
        authUrl: '/auth/oauth/github/authorize',
      });
    }

    if (this.config.enabledAnonymous) {
      methods.push({
        provider: AuthenticationProvider.ANONYMOUS,
        displayName: 'Continue as Guest',
        icon: 'user',
        enabled: true,
      });
    }

    return methods;
  }

  async validateRequired(authorizationHeader: string | undefined): Promise<Result<PrincipalDto, Error>> {
    if (!authorizationHeader) {
      return err(new Error('No authorization header'));
    }

    const token = authorizationHeader.replace(/^Bearer\\s+/i, '');
    if (!token || token === authorizationHeader) {
      return err(new Error('Invalid authorization header format'));
    }

    const verified = await this.idTokenVerifier.verifyIdToken(token);
    if (isErr(verified)) {
      return err(verified.error);
    }

    let identityId: string | undefined;
    let subjectId: string | undefined;
    const prov = this.identityGraphProvisioner?.();
    if (prov) {
      const ensured = await prov.ensureIdentityForFirebaseUid(verified.value.uid);
      if (ensured.ok) {
        identityId = ensured.value.identityId;
        subjectId = ensured.value.subjectId;
      }
    }

    return ok({
      uid: verified.value.uid,
      identityId,
      subjectId,
      email: verified.value.email,
      authTime: verified.value.authTime,
      claims: verified.value.claims,
    });
  }

  async validateOptional(authorizationHeader: string | undefined): Promise<Result<TokenValidationResultDto, Error>> {
    if (!authorizationHeader) {
      return ok({ authenticated: false, principal: { anonymous: true } });
    }

    const required = await this.validateRequired(authorizationHeader);
    if (isErr(required)) {
      // Optional auth: any validation failure falls back to anonymous
      return ok({ authenticated: false, principal: { anonymous: true } });
    }

    return ok({ authenticated: true, principal: required.value });
  }

  async signInWithEmailPassword(email: string, password: string): Promise<Result<AuthSessionDto, Error>> {
    if (!this.config.firebaseWebApiKey) {
      return err(new Error('Email/password authentication not configured'));
    }

    const session = await this.sessionGateway.signInWithPassword(email, password);
    if (isErr(session)) {
      const code = getErrorCode(session.error) ?? session.error.message;
      return err(new Error(mapFirebaseError(code)));
    }

    return session;
  }

  async signInAnonymously(): Promise<Result<AuthSessionDto, Error>> {
    if (!this.config.enabledAnonymous) {
      return err(new Error('Anonymous authentication not enabled'));
    }

    if (!this.config.firebaseWebApiKey) {
      return err(new Error('Anonymous authentication not configured'));
    }

    return await this.sessionGateway.signUpAnonymous();
  }

  async exchangeOAuthCodeForSession(
    provider: OAuthProvider,
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<Result<AuthSessionDto, Error>> {
    if (!this.config.firebaseWebApiKey) {
      return err(new Error('Firebase configuration incomplete'));
    }

    const userInfo = await this.oauthCodeExchanger.exchangeCode(provider, code, redirectUri, codeVerifier);
    if (isErr(userInfo)) {
      return err(userInfo.error);
    }

    // Get or create user in the external IdP (Firebase)
    const getUserResult = await this.userProvisioner.getUserByEmail(userInfo.value.email);
    let uid: string | undefined;
    let createdInFirebase = false;

    if (isErr(getUserResult)) {
      const code = getErrorCode(getUserResult.error as ErrorWithCode);
      if (code !== 'auth/user-not-found') {
        return err(getUserResult.error);
      }

      const created = await this.userProvisioner.createUser({
        email: userInfo.value.email,
        displayName: userInfo.value.name,
        photoURL: userInfo.value.picture,
        emailVerified: userInfo.value.emailVerified ?? true,
      });
      if (isErr(created)) {
        return err(created.error);
      }
      uid = created.value.uid;
      createdInFirebase = true;
    } else {
      uid = getUserResult.value.uid;
    }

    if (!uid) {
      return err(new Error('Failed to provision user'));
    }

    const customToken = await this.userProvisioner.createCustomToken(uid);
    if (isErr(customToken)) {
      return err(customToken.error);
    }

    // Ensure internal identity graph node exists (best effort).
    const prov = this.identityGraphProvisioner?.();
    if (prov) {
      await prov.ensureIdentityForFirebaseUid(uid);
    }

    return await this.sessionGateway.signInWithCustomToken(customToken.value);
  }

  async refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>> {
    if (!this.config.firebaseWebApiKey) {
      return err(new Error('Token refresh not configured'));
    }

    return await this.sessionGateway.refresh(refreshToken);
  }
}

