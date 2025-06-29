helm repo add minio https://charts.min.io/
helm repo update

helm install my-minio minio/minio \
  --set rootUser=myaccesskey \
  --set rootPassword=mysecretkey \
  --set mode=standalone \
  --set persistence.enabled=true \
  --set consoleService.type=ClusterIP \
  --set apiService.type=ClusterIP