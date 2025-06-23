kubectl exec -n vault -it vault-0 -- /bin/sh


vault write auth/kubernetes/role/editor-agent-role \
  bound_service_account_names=editor-agent-auth \
  bound_service_account_namespaces=editorial \
  policies=rabbitmq-policy,editorial-database-policy,editorial-service-policy,open-ai-policy \
  ttl=1h