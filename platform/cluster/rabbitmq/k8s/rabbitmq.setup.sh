helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

kubectl create namespace rabbitmq


helm install rabbitmq bitnami/rabbitmq \
  --namespace rabbitmq \
  --set auth.username=admin \
  --set auth.password=secretpassword \
  --set auth.erlangCookie=supersecretcookie \
  --set persistence.enabled=true \
  --set service.type=ClusterIP

kubectl apply -f rabbit-mq-ingress.yaml