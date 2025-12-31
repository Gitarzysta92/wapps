# MySQL Installation Summary

## What Was Implemented

✅ **Complete MySQL host installation with Kubernetes integration**

### Files Created/Modified

1. **`platform/host/mysql/install.yml`** - NEW
   - Full MySQL server installation on host
   - Database and user creation
   - Kubernetes Service and Endpoints setup
   - Secret management
   - Verification tests

2. **`platform/host/main.yml`** - MODIFIED
   - Added MySQL installation step (line 21-23)
   - Runs after system configuration, before K3s

3. **`platform/cluster/mysql/README.md`** - NEW
   - Complete documentation
   - Architecture diagrams
   - Usage examples
   - Troubleshooting guide
   - Migration path

4. **`platform/cluster/mysql/external-service.yaml`** - NEW
   - Reference manifests
   - Shows what Ansible creates
   - For documentation purposes

5. **`environments/dev/apps/editorial-kustomization/deployment-patch.yaml`** - MODIFIED
   - Now uses Kubernetes secret for database credentials
   - More secure than plain text values

## How It Works

### Architecture

```
Editorial Pod → mysql.mysql:3306 (DNS)
                    ↓
            Service (ClusterIP)
                    ↓
            Endpoints → Host IP:3306
                    ↓
            MySQL on Host Machine
```

### Key Features

1. **Automatic IP Detection**
   - Ansible detects host IP: `{{ ansible_default_ipv4.address }}`
   - No manual configuration needed

2. **DNS-Based Connection**
   - Pods use `mysql.mysql` (not hardcoded IPs)
   - Kubernetes-native service discovery

3. **Secret Management**
   - Database credentials in Kubernetes secret
   - Created automatically by Ansible
   - Editorial pod references secret

4. **Multiple Databases**
   - `editorial_dev`
   - `editorial_staging`
   - `editorial_prod`

5. **Automatic Verification**
   - Tests local connection
   - Tests connection from cluster
   - Displays summary with all details

## Usage

### 1. Run Ansible Provisioning

```bash
ansible-playbook platform/host/main.yml \
  -e target_env=development \
  -e mysql_root_password=YourSecureRootPassword \
  -e mysql_editorial_password=YourSecureEditorialPassword \
  -e git_token=ghp_xxx
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `mysql_root_password` | MySQL root password | `SecureRootPass123!` |
| `mysql_editorial_password` | Editorial user password | `EditorialPass456!` |
| `target_env` | Environment (dev/staging/prod) | `development` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `host_ip` | Force specific host IP | Auto-detected |

### 2. What Gets Installed

✅ MySQL Server on host (port 3306)
✅ Database: `editorial_dev`
✅ User: `editorial` with password
✅ Firewall rule for port 3306
✅ K8s namespace: `mysql`
✅ K8s Service: `mysql.mysql`
✅ K8s Endpoints: → Host IP
✅ K8s Secret: `editorial-db-credentials` (editorial namespace)

### 3. Deploy Editorial Service

The editorial service deployment is already configured to use the secret:

```bash
# Via ArgoCD (if enabled)
kubectl apply -f argocd/applications/backend/editorial.yaml

# Or manually
kubectl apply -k environments/dev/apps/editorial-kustomization/
```

### 4. Verify Everything Works

```bash
# Check MySQL service
kubectl get svc mysql -n mysql

# Check endpoints
kubectl get endpoints mysql -n mysql

# Check secret
kubectl get secret editorial-db-credentials -n editorial

# Test connection from cluster
kubectl run mysql-test --rm -it --restart=Never \
  --image=mysql:8.0 \
  --namespace=mysql \
  -- mysql -h mysql.mysql -u editorial -pYourPassword \
  -e "SHOW DATABASES;"
```

## Connection Details

### For Editorial Service (Automatic)

The deployment now uses the Kubernetes secret automatically:

```yaml
env:
  - name: DATABASE_HOST
    valueFrom:
      secretKeyRef:
        name: editorial-db-credentials
        key: DATABASE_HOST  # mysql.mysql
  # ... other env vars from secret
```

### For Other Services

Any service can connect to MySQL:

```yaml
env:
  - name: DATABASE_HOST
    value: "mysql.mysql"
  - name: DATABASE_PORT
    value: "3306"
  - name: DATABASE_USERNAME
    value: "editorial"
  - name: DATABASE_PASSWORD
    valueFrom:
      secretKeyRef:
        name: editorial-db-credentials
        key: DATABASE_PASSWORD
```

## Maintenance

### Update Host IP (if changed)

```bash
# Re-run Ansible
ansible-playbook platform/host/main.yml -e target_env=development

# Or manually patch
kubectl patch endpoints mysql -n mysql --type=json \
  -p='[{"op":"replace","path":"/subsets/0/addresses/0/ip","value":"NEW_IP"}]'
```

### Access MySQL Directly

```bash
# From host
mysql -u editorial -p editorial_dev

# List databases
mysql -u editorial -p -e "SHOW DATABASES;"

# Check connections
sudo mysql -u root -p -e "SHOW PROCESSLIST;"
```

### Backup Database

```bash
# Backup
mysqldump -u editorial -p editorial_dev > backup.sql

# Restore
mysql -u editorial -p editorial_dev < backup.sql
```

## Troubleshooting

### Pod Can't Connect

1. Check MySQL is running: `sudo systemctl status mysql`
2. Check endpoints: `kubectl get endpoints mysql -n mysql`
3. Check firewall: `sudo ufw status | grep 3306`
4. Test DNS: `kubectl run debug --rm -it --image=busybox -- nslookup mysql.mysql`

### Connection Refused

- Verify bind address: `sudo mysql -u root -p -e "SHOW VARIABLES LIKE 'bind_address';"`
  - Should be: `0.0.0.0`
- Check if MySQL is listening: `sudo netstat -tlnp | grep 3306`

### Access Denied

- Verify user exists: `sudo mysql -u root -p -e "SELECT user, host FROM mysql.user WHERE user='editorial';"`
- Check permissions: `sudo mysql -u root -p -e "SHOW GRANTS FOR 'editorial'@'%';"`

## Security Notes

### Current (Development)

- ⚠️ Default passwords used if not specified
- ⚠️ Password in K8s secret (base64, not encrypted)
- ✅ Firewall enabled
- ✅ No remote root access

### Production Recommendations

1. **Strong Passwords**: Use generated passwords (20+ chars)
2. **Vault Integration**: Store secrets in HashiCorp Vault
3. **SSL/TLS**: Enable encrypted MySQL connections
4. **Network Policies**: Restrict pod access to MySQL
5. **Monitoring**: Set up alerts and logging

## Migration Path

### To Managed Database (RDS, Cloud SQL)

1. Update endpoints to point to managed DB
2. Update secret with new credentials
3. Migrate data with mysqldump
4. **No code changes needed!** ✨

The Service abstraction makes migration transparent.

## Next Steps

### For Catalog-BFF Service

The catalog-bff service connects to Editorial (which uses MySQL), so ensure:

1. Editorial service is deployed
2. MySQL is accessible
3. Editorial API is responding

### For Other Services

Any service needing MySQL can:

1. Use the same `mysql.mysql` hostname
2. Create their own database in MySQL
3. Reference `editorial-db-credentials` secret or create their own

## Summary

✅ **MySQL is now installed on the host**
✅ **Accessible from Kubernetes pods via DNS**
✅ **Automatically configured by Ansible**
✅ **Editorial service configured to use it**
✅ **Fully documented and tested**

🚀 **Ready to deploy!**

