2. Sample Vault Policy/Role
Vault Policy (HCL):


path "secret/data/editorial/strapi-db" {
  capabilities = ["read"]
}


vault write auth/kubernetes/role/editorial-strapi-role \
  bound_service_account_names=vault-auth \
  bound_service_account_namespaces=editorial \
  policies=editorial-strapi-policy \
  ttl=24h