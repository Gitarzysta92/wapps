# Discussion Service Provisioning

## Kubernetes Secrets

The discussion service requires the following secrets to be created in the `discussion` namespace:

- `discussion-app-secrets` with the following keys:
  - `DISCUSSION_DATABASE_HOST`
  - `DISCUSSION_DATABASE_PORT`
  - `DISCUSSION_DATABASE_USERNAME`
  - `DISCUSSION_DATABASE_PASSWORD`
  - `DISCUSSION_DATABASE_NAME`

## Vault Policy/Role

Sample Vault Policy (HCL):

```
path "secret/data/discussion/db" {
  capabilities = ["read"]
}
```

Vault role configuration:

```bash
vault write auth/kubernetes/role/discussion-role \
  bound_service_account_names=vault-auth \
  bound_service_account_namespaces=discussion \
  policies=discussion-policy \
  ttl=24h
```
