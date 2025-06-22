kubectl exec -n vault -it vault-0 -- /bin/sh

export VAULT_ADDR=http://127.0.0.1:8200
vault login <your-root-token>

vault policy write editorial-service rabbitmq-policy.hcl

path "secret/data/editorial/strapi-db" {
  capabilities = ["read"]
}


echo 'path "secret/data/editorial/database" { capabilities = ["read"] }' | vault policy write editorial-service-policy -