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
│  │ Editorial    │         │ Other Services │           │
│  │ Pod          │────────▶│ (future)       │           │
│  └──────┬───────┘         └────────────────┘           │
│         │                                                │
│         │ Connects to: mysql.mysql:3306                 │
│         ▼                                                │
│  ┌────────────────────────────────────┐                │
│  │  Service: mysql                    │                │
│  │  Namespace: mysql                  │                │
│  │  ClusterIP: 10.43.x.x:3306         │                │
│  │  (No pod selector)                 │                │
│  └────────────┬───────────────────────┘                │
│               │                                          │
│               │ Routes via Endpoints                     │
│               ▼                                          │
│  ┌────────────────────────────────────┐                │
│  │  Endpoints: mysql                  │                │
│  │  Target: 192.168.1.100:3306        │◀───────────┐   │
│  └────────────┬───────────────────────┘            │   │
└───────────────┼────────────────────────────────────┼───┘
                │                                     │
                │ Traffic exits cluster               │
                ▼                                     │
┌───────────────────────────────────────────────┐    │
│              Host Machine                      │    │
│           IP: 192.168.1.100                    │────┘
│                                                │
│  ┌─────────────────────────────────┐          │
│  │  MySQL Server (native)          │          │
│  │  Bind: 0.0.0.0:3306              │          │
│  │  Config: /etc/mysql/mysql.conf.d │          │
│  │                                  │          │
│  │  Databases:                      │          │
│  │  - editorial_dev                 │          │
│  │  - editorial_staging             │          │
│  │  - editorial_prod                │          │
│  └─────────────────────────────────┘          │
└───────────────────────────────────────────────┘
```

## Installation

MySQL is automatically installed via Ansible during host provisioning:

```bash
ansible-playbook platform/host/main.yml \
  -e target_env=development \
  -e mysql_root_password=SecureRootPassword \
  -e mysql_editorial_password=SecureEditorialPassword \
  -e git_token=ghp_xxx
```

### What Gets Installed

1. **MySQL Server** on host
2. **MySQL Configuration** (`/etc/mysql/mysql.conf.d/wapps.cnf`)
3. **Databases**: `editorial_dev`, `editorial_staging`, `editorial_prod`
4. **Database User**: `editorial` with full access
5. **Kubernetes Service**: `mysql.mysql` 
6. **Kubernetes Endpoints**: Pointing to host IP
7. **Kubernetes Secret**: `editorial-db-credentials` in `editorial` namespace
8. **Firewall Rule**: Allow port 3306

## Accessing MySQL from Pods

### Method 1: Environment Variables (Simple)

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
            value: "editorial"
          - name: DATABASE_PASSWORD
            valueFrom:
              secretKeyRef:
                name: editorial-db-credentials
                key: DATABASE_PASSWORD
```

### Method 2: Kubernetes Secret (Recommended)

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

The secret contains:
- `DATABASE_CLIENT`: `mysql2`
- `DATABASE_HOST`: `mysql.mysql`
- `DATABASE_PORT`: `3306`
- `DATABASE_NAME`: `editorial_dev` (or staging/prod)
- `DATABASE_USERNAME`: `editorial`
- `DATABASE_PASSWORD`: (your password)

## DNS Resolution

Pods can use any of these to connect:
- `mysql.mysql` (short form, within same namespace context)
- `mysql.mysql.svc` (with service suffix)
- `mysql.mysql.svc.cluster.local` (fully qualified)

All resolve to the Service's ClusterIP, which routes to the host.

## Maintenance

### View Service and Endpoints

```bash
# View service
kubectl get svc mysql -n mysql -o yaml

# View endpoints
kubectl get endpoints mysql -n mysql -o yaml

# View secret
kubectl get secret editorial-db-credentials -n editorial -o yaml
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
  -- mysql -h mysql.mysql -u editorial -p

# With command
kubectl run mysql-test --rm -it --restart=Never \
  --image=mysql:8.0 \
  --namespace=mysql \
  -- mysql -h mysql.mysql -u editorial -pYOUR_PASSWORD \
  -e "SHOW DATABASES;"
```

### Access MySQL from Host

```bash
# Connect as editorial user
mysql -u editorial -p editorial_dev

# Connect as root
sudo mysql -u root -p

# Run a query
mysql -u editorial -p editorial_dev -e "SHOW TABLES;"
```

### Backup Databases

```bash
# Backup single database
mysqldump -u editorial -p editorial_dev > editorial_dev_backup.sql

# Backup all editorial databases
for db in editorial_dev editorial_staging editorial_prod; do
  mysqldump -u editorial -p $db > ${db}_backup_$(date +%Y%m%d).sql
done

# Restore from backup
mysql -u editorial -p editorial_dev < editorial_dev_backup.sql
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

- Check user permissions: `mysql -u root -p -e "SELECT user, host FROM mysql.user WHERE user='editorial';"`
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

### Production Recommendations

1. **Use Vault for Secrets**
   - Store passwords in HashiCorp Vault
   - Use Vault Agent injection for pods
   - Rotate passwords regularly

2. **Network Policies**
   - Restrict which pods can access MySQL
   - Only allow editorial namespace

3. **Strong Passwords**
   - Use generated passwords (not defaults)
   - Minimum 20 characters

4. **SSL/TLS**
   - Enable SSL for MySQL connections
   - Configure pods to use SSL

5. **Monitoring**
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

2. **Update Secret** with new credentials
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

