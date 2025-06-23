kubectl exec -n vault -it vault-0 -- /bin/sh


vault write auth/kubernetes/role/editorial-service-role \
  bound_service_account_names=editorial-service \
  bound_service_account_namespaces=editorial \
  policies=editorial-database-policy \
  ttl=1h