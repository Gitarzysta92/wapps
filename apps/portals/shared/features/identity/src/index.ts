// Core identity exports
export * from './infrastructure/identity-api.service';

// Feature exports
export * from './infrastructure/identity-registration-api.service';
export * from './infrastructure/password-reset-api.service';
export * from './infrastructure/password-reset-request-api.service';

// BFF authentication exports
export { BffAuthenticationService } from './infrastructure/bff/bff-authentication.service';
export { AUTH_BFF_URL } from './infrastructure/bff/auth-bff-url.token';

export * from './login.providers';
export * from './management.providers';
export * from './registration.providers';
export * from './password-reset-request.providers';
export * from './password-reset.providers';
export * from './email-verification.providers';
export * from './account-export.providers';
export * from './reply-inbox.providers';
export * from './application/reply-inbox.port';
export * from './application/reply-inbox.service';
export * from './account-erasure.providers';
export * from './presentation/components/account-erasure/account-erasure-panel.component';
export * from './application/account-export.port';
export * from './presentation/components/account-export/account-export-panel.component';
export * from './application/email-verification.port';
export * from './presentation/components/email-verification/email-verification-status.component';
export * from './presentation/components/email-verification/email-verification-action.component';

export { AuthenticationService } from './application/authentication.service';
export * from './application/authentication-session.port';
export { LoginContainerComponent } from './presentation/components/login/login-container.component';
export { PasswordResetRequestContainerComponent } from './presentation/components/password-reset/password-reset-request-container.component';
export { PasswordResetContainerComponent } from './presentation/components/password-reset/password-reset-container.component';
export { RegistrationContainerComponent } from './presentation/components/registration/registration-container.component';
export { AuthenticationGuard } from './presentation/guards/authentication.guard';
export { OAuthCallbackComponent } from './presentation/components/oauth-callback/oauth-callback.component';

export * from './favorite-updates.providers';
export * from './application/favorite-updates.service';
export * from './application/favorite-updates.port';

export * from './mention-inbox.providers';
export * from './application/mention-inbox.port';
export * from './application/mention-inbox.service';
