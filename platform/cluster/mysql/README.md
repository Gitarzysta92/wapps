# MySQL on Host - Kubernetes Integration

This directory contains documentation and reference manifests for accessing the host-based MySQL server from Kubernetes pods.

## Overview

MySQL is **installed on the host machine** (not in the cluster) for better:
- ✅ Data persistence
- ✅ Performance
- ✅ Simplified backups
- ✅ Resource management

Kubernetes pods access the host MySQL through a **Service with manual Endpoints** that points to the host IP.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                      │
│                                                          │
│  ┌──────────────┐         ┌────────────────┐           │
│  │ Editorial    │         │ Catalog-BFF    │           │
│  │ Pod          │         │ Pod            │           │
│  └──────┬───────┘         └────────┬───────┘           │
│         │                          │                    │
│         │ Connects to: mysql.mysql:3306                │
│         ▼                          ▼                    │
│  ┌────────────────────────────────────────────┐        │
│  │  Service: mysql                            │        │
│  │  Namespace: mysql                          │        │
│  │  ClusterIP: 10.43.x.x:3306                 │        │
│  │  (No pod selector)                         │        │
│  └────────────┬───────────────────────────────┘        │
│               │                                          │
│               │ Routes via Endpoints                     │
│               ▼                                          │
│  ┌────────────────────────────────────────────┐        │
│  │  Endpoints: mysql                          │◀───┐   │
│  │  Target: 192.168.1.100:3306                │    │   │
│  └────────────┬───────────────────────────────┘    │   │
└───────────────┼────────────────────────────────────┼───┘
                │                                     │
                │ Traffic exits cluster               │
                ▼                                     │
┌───────────────────────────────────────────────┐    │
│              Host Machine                      │────┘
│           IP: 192.168.1.100                    │
│                                                │
│  ┌─────────────────────────────────┐          │
│  │  MySQL Server (native)          │          │
│  │  Bind: 0.0.0.0:3306              │          │
│  │  Config: /etc/mysql/mysql.conf.d │          │
│  │                                  │          │
│  │  Shared User: wapps_app          │          │
│  │                                  │          │
│  │  Databases:                      │          │
│  │  - editorial_dev                 │          │
│  │  - editorial_staging             │          │
│  │  - editorial_prod                │          │
│  │  - catalog_dev                   │          │
│  │  - catalog_staging               │          │
│  │  - catalog_prod                  │          │
│  └─────────────────────────────────┘          │
└───────────────────────────────────────────────┘
```

## Installation

MySQL is automatically installed via Ansible during host provisioning:

```bash
ansible-playbook platform/host/main.yml \
  -e target_env=development \
  -e mysql_root_password=SecureRootPassword \
  -e mysql_wapps_password=SecureWappsAppPassword \
  -e git_token=ghp_xxx
```

### What Gets Installed

1. **MySQL Server** on host
2. **MySQL Configuration** (`/etc/mysql/mysql.conf.d/wapps.cnf`)
3. **Databases**: `editorial_*`, `catalog_*` (dev/staging/prod)
4. **Shared User**: `wapps_app` with access to all databases
5. **Kubernetes Service**: `mysql.mysql` 
6. **Kubernetes Endpoints**: Pointing to host IP
7. **Kubernetes Secrets**: 
   - `mysql-credentials` (shared, in mysql namespace)
   - `editorial-db-credentials` (in editorial namespace)
   - `catalog-db-credentials` (in catalog namespace)
8. **Firewall Rule**: Allow port 3306

## MySQL Web UI (Adminer)

For a browser-based MySQL editor (similar to Mongo Express), this repo ships **Adminer** as a small platform component:

- **Kubernetes manifests**: `platform/cluster/mysql-adminer/`
- **Dev hostname**: `mysql-adminer.development.wapps.ai`
- **Namespace**: `mysql`
- **Default server**: `mysql.mysql` (pre-filled in the UI)

Log in with the MySQL user created by host provisioning (typically `wapps_app`) and the password stored in the `mysql-credentials` secret.

## Accessing MySQL from Pods

### Method 1: Service-Specific Secret (Recommended)

Each service has its own secret with the correct DATABASE_NAME:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: editorial
  namespace: editorial
spec:
  template:
    spec:
      containers:
      - name: editorial
        image: editorial:latest
        envFrom:
          - secretRef:
              name: editorial-db-credentials
```

### Method 2: Shared Secret + Custom DATABASE_NAME

Use the shared secret and override the database name:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
  namespace: my-namespace
spec:
  template:
    spec:
      containers:
      - name: my-service
        image: my-service:latest
        envFrom:
          - secretRef:
              name: mysql-credentials
        env:
          - name: DATABASE_NAME
            value: "my_database_dev"
```

### Method 3: Individual Environment Variables

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: editorial
  namespace: editorial
spec:
  template:
    spec:
      containers:
      - name: editorial
        image: editorial:latest
        env:
          - name: DATABASE_HOST
            value: "mysql.mysql"
          - name: DATABASE_PORT
            value: "3306"
          - name: DATABASE_NAME
            value: "editorial_dev"
          - name: DATABASE_USERNAME
            valueFrom:
              secretKeyRef:
                name: editorial-db-credentials
                key: DATABASE_USERNAME
          - name: DATABASE_PASSWORD
            valueFrom:
              secretKeyRef:
                name: editorial-db-credentials
                key: DATABASE_PASSWORD
```

## Secret Contents

### Shared Secret (`mysql-credentials` in mysql namespace)
- `DATABASE_CLIENT`: `mysql`
- `DATABASE_HOST`: `mysql.mysql`
- `DATABASE_PORT`: `3306`
- `DATABASE_USERNAME`: `wapps_app`
- `DATABASE_PASSWORD`: (your password)

### Service-Specific Secrets
Same as shared, plus:
- `DATABASE_NAME`: Service-specific database (e.g., `editorial_dev`)

## DNS Resolution

Pods can use any of these to connect:
- `mysql.mysql` (short form, within same namespace context)
- `mysql.mysql.svc` (with service suffix)
- `mysql.mysql.svc.cluster.local` (fully qualified)

All resolve to the Service's ClusterIP, which routes to the host.

## Adding New Services

1. **Add database to Ansible** (`platform/host/mysql/install.yml`):
   ```yaml
   # In the database creation loop
   - my_service_dev
   - my_service_staging
   - my_service_prod
   ```

2. **Update user privileges**:
   ```yaml
   priv: '..../my_service_dev.*:ALL/my_service_staging.*:ALL/my_service_prod.*:ALL'
   ```

3. **Add secret creation task** in Ansible for the new service

4. **Re-run Ansible**:
   ```bash
   ansible-playbook platform/host/main.yml --tags mysql
   ```

## Maintenance

### View Service and Endpoints

```bash
# View service
kubectl get svc mysql -n mysql -o yaml

# View endpoints
kubectl get endpoints mysql -n mysql -o yaml

# View secrets
kubectl get secret mysql-credentials -n mysql -o yaml
kubectl get secret editorial-db-credentials -n editorial -o yaml
kubectl get secret catalog-db-credentials -n catalog -o yaml
```

### Update Host IP (if it changes)

The Ansible playbook automatically updates the endpoints with the current host IP. If the host IP changes, re-run:

```bash
ansible-playbook platform/host/main.yml \
  -e target_env=development \
  --tags mysql
```

Or manually patch:

```bash
# Get new host IP
NEW_IP=$(hostname -I | awk '{print $1}')

# Update endpoints
kubectl patch endpoints mysql -n mysql --type=json \
  -p='[{"op": "replace", "path": "/subsets/0/addresses/0/ip", "value":"'$NEW_IP'"}]'
```

### Test Connection from Cluster

```bash
# Quick test
kubectl run mysql-test --rm -it --restart=Never \
  --image=mysql:8.0 \
  --namespace=mysql \
  -- mysql -h mysql.mysql -u wapps_app -p

# With command
kubectl run mysql-test --rm -it --restart=Never \
  --image=mysql:8.0 \
  --namespace=mysql \
  -- mysql -h mysql.mysql -u wapps_app -pYOUR_PASSWORD \
  -e "SHOW DATABASES;"
```

### Access MySQL from Host

```bash
# Connect as wapps_app user
mysql -u wapps_app -p editorial_dev

# Connect as root
sudo mysql -u root -p

# Run a query
mysql -u wapps_app -p editorial_dev -e "SHOW TABLES;"
```

### Backup Databases

```bash
# Backup single database
mysqldump -u wapps_app -p editorial_dev > editorial_dev_backup.sql

# Backup all databases
for db in editorial_dev editorial_staging editorial_prod catalog_dev catalog_staging catalog_prod; do
  mysqldump -u wapps_app -p $db > ${db}_backup_$(date +%Y%m%d).sql
done

# Restore from backup
mysql -u wapps_app -p editorial_dev < editorial_dev_backup.sql
```

### Monitor MySQL

```bash
# Check MySQL status
sudo systemctl status mysql

# View MySQL logs
sudo tail -f /var/log/mysql/error.log

# Check connections
sudo mysql -u root -p -e "SHOW PROCESSLIST;"

# Check database sizes
sudo mysql -u root -p -e "
  SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
  FROM information_schema.tables
  GROUP BY table_schema;"
```

## Troubleshooting

### Pod Can't Connect to MySQL

1. **Check if MySQL is running on host:**
   ```bash
   sudo systemctl status mysql
   sudo netstat -tlnp | grep 3306
   ```

2. **Verify bind address:**
   ```bash
   sudo mysql -u root -p -e "SHOW VARIABLES LIKE 'bind_address';"
   # Should show: 0.0.0.0
   ```

3. **Check Kubernetes endpoints:**
   ```bash
   kubectl get endpoints mysql -n mysql
   # Should show host IP, not empty
   ```

4. **Test from pod:**
   ```bash
   kubectl run debug --rm -it --image=busybox -- sh
   # Inside pod:
   nc -zv mysql.mysql 3306
   ```

5. **Check firewall:**
   ```bash
   sudo ufw status | grep 3306
   # Should show: 3306/tcp ALLOW Anywhere
   ```

### Connection Refused

- Verify MySQL is listening on all interfaces: `sudo netstat -tlnp | grep 3306`
- Check if firewall is blocking: `sudo ufw status`
- Verify endpoints IP matches host IP: `kubectl get endpoints mysql -n mysql`

### Access Denied

- Check user permissions: `mysql -u root -p -e "SELECT user, host FROM mysql.user WHERE user='wapps_app';"`
- Verify password is correct in secret: `kubectl get secret editorial-db-credentials -n editorial -o yaml`

### DNS Not Resolving

- Check if service exists: `kubectl get svc mysql -n mysql`
- Test DNS from pod: `kubectl run debug --rm -it --image=busybox -- nslookup mysql.mysql`

## Security Considerations

### Current Setup (Development)

- ✅ User password required
- ✅ Firewall rule in place
- ✅ No remote root access
- ⚠️ Password stored in K8s secret (base64 encoded, not encrypted)
- ⚠️ Accessible from any pod in cluster
- ⚠️ Single user for all services (simpler but less isolated)

### Production Recommendations

1. **Use Vault for Secrets**
   - Store passwords in HashiCorp Vault
   - Use Vault Agent injection for pods
   - Rotate passwords regularly

2. **Per-Service Users** (if isolation needed)
   - Create separate MySQL users per service
   - Each user only has access to its own database

3. **Network Policies**
   - Restrict which pods can access MySQL
   - Only allow specific namespaces

4. **Strong Passwords**
   - Use generated passwords (not defaults)
   - Minimum 20 characters

5. **SSL/TLS**
   - Enable SSL for MySQL connections
   - Configure pods to use SSL

6. **Monitoring**
   - Set up alerts for failed login attempts
   - Monitor connection counts
   - Track slow queries

## Migration Path

### Moving to Managed Database

When migrating to a managed database (AWS RDS, Google Cloud SQL, etc.):

1. **Update Endpoints** to point to managed database:
   ```bash
   kubectl patch endpoints mysql -n mysql --type=json \
     -p='[{"op":"replace","path":"/subsets/0/addresses/0/ip","value":"db.example.com"}]'
   ```

2. **Update Secrets** with new credentials
3. **Test connection** from pods
4. **Migrate data** using mysqldump
5. **No application code changes needed!** ✨

The Service abstraction makes this migration transparent to applications.

## Files

- `external-service.yaml` - Reference K8s manifest (for manual deployment)
- `README.md` - This file

## Related

- Installation: `platform/host/mysql/install.yml`
- Main playbook: `platform/host/main.yml`
- Editorial deployment: `environments/dev/apps/editorial-kustomization/`
- Catalog deployment: `environments/dev/apps/catalog-bff-kustomization/`
