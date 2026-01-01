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

export { AuthenticationService } from './application/authentication.service';
export { LoginContainerComponent } from './presentation/components/login/login-container.component';
export { PasswordResetRequestContainerComponent } from './presentation/components/password-reset/password-reset-request-container.component';
export { RegistrationContainerComponent } from './presentation/components/registration/registration-container.component';
export { AuthenticationGuard } from './presentation/guards/authentication.guard';
export { OAuthCallbackComponent } from './presentation/components/oauth-callback/oauth-callback.component';