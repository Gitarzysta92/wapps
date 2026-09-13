# Authenticator

NestJS authentication service using Firebase sessions and MySQL application identities. Application source, build configuration, and Dockerfile live here; Kubernetes manifests live in `../provisioning/k8s`.

## HTTP API

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/auth/methods` | Enabled email, Google, GitHub, and anonymous methods |
| POST | `/auth/signin` | Email/password sign-in |
| POST | `/auth/signin/anonymous` | Anonymous Firebase sign-in when enabled |
| POST | `/auth/signin/oauth` | Exchange Google/GitHub code for a session |
| GET | `/auth/oauth/google/authorize` | Google authorization redirect; supports PKCE |
| GET | `/auth/oauth/github/authorize` | GitHub authorization redirect |
| POST | `/auth/refresh` | Refresh session and check application identity state |
| POST | `/auth/signout` | Revoke refresh tokens for the authenticated Firebase user |
| GET | `/validate` | Require a valid token and active application identity |
| GET | `/validate-optional` | Return anonymous access when authentication is unavailable |
| GET | `/health` | Application health |
| GET | `/api-docs` | Swagger UI |

Sign-in and refresh return `{ token, refreshToken, expiresIn, uid }`. Required validation returns user headers for ingress, including `X-User-Id`, `X-User-Email`, and `X-Ingress-Auth` when configured.

Firebase UID is the stable MySQL claim. First sign-in creates an active identity; returning sign-ins preserve account flags. Disabled, suspended, deleted, or missing identities cannot validate or refresh. A missing identity can be created only after successful provider authentication.

## Build and test

From the workspace root:

```sh
npx nx build sdk-features-identity-applications-authenticator
npx nx test sdk-features-identity-applications-authenticator --runInBand
npx nx test sdk-features-identity-authentication --runInBand
```

The Docker build context is `dist/sdk/features/identity/applications/authenticator`.

See [the SDK guide](../../../../../README.md) for required environment variables, database migration and legacy-data cutover requirements, RabbitMQ event semantics, and deployment verification.
