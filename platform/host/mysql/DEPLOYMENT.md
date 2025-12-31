# MySQL Deployment Guide

## ✅ Prerequisites Checklist

Before deploying, ensure you have:

- [x] GitHub secrets added:
  - `MYSQL_ROOT_PASSWORD`
  - `MYSQL_EDITORIAL_PASSWORD`
- [x] Self-hosted GitHub Actions runner configured
- [x] Workflow file updated (done automatically)

## 🚀 Deployment Steps

### Step 1: Trigger the Workflow

#### Option A: Via GitHub UI (Recommended)

1. Go to your repository on GitHub
2. Click the **"Actions"** tab
3. Select **"Host Environment Provisioning (Ansible)"** from the left sidebar
4. Click **"Run workflow"** button (top right)
5. Select target environment:
   - `development` (for dev environment)
   - `staging` (for staging environment)  
   - `production` (for production environment)
6. Click **"Run workflow"**

#### Option B: Via GitHub CLI

```bash
# For development
gh workflow run host-environment-provisioning.workflow.yml -f env=development

# For staging
gh workflow run host-environment-provisioning.workflow.yml -f env=staging

# For production
gh workflow run host-environment-provisioning.workflow.yml -f env=production
```

### Step 2: Monitor the Workflow

```bash
# Watch the workflow run
gh run watch

# Or view logs
gh run view --log
```

### Step 3: Verify Installation

Once the workflow completes, verify MySQL is running:

```bash
# SSH into your host
ssh user@your-host

# Check MySQL service
sudo systemctl status mysql

# Check if MySQL is listening
sudo netstat -tlnp | grep 3306

# Test local connection
mysql -u editorial -p -e "SHOW DATABASES;"
# Enter the password you set in MYSQL_EDITORIAL_PASSWORD
```

### Step 4: Verify Kubernetes Integration

```bash
# Check if MySQL service exists
kubectl get svc mysql -n mysql

# Check endpoints (should show your host IP)
kubectl get endpoints mysql -n mysql

# Test connection from cluster
kubectl run mysql-test --rm -it --restart=Never \
  --image=mysql:8.0 \
  --namespace=mysql \
  -- mysql -h mysql.mysql -u editorial -p \
  -e "SHOW DATABASES;"
```

### Step 5: Verify Secret Creation

```bash
# Check if editorial-db-credentials secret exists
kubectl get secret editorial-db-credentials -n editorial

# View secret contents (base64 encoded)
kubectl get secret editorial-db-credentials -n editorial -o yaml
```

## 📋 What Gets Deployed

When you run the workflow, the following will be deployed:

### On Host Machine:
- ✅ MySQL Server (port 3306)
- ✅ Database: `editorial_dev` (or `editorial_staging`, `editorial_prod`)
- ✅ User: `editorial` with full access
- ✅ Firewall rule allowing port 3306
- ✅ MySQL configuration: `/etc/mysql/mysql.conf.d/wapps.cnf`

### In Kubernetes Cluster:
- ✅ Namespace: `mysql`
- ✅ Service: `mysql` (ClusterIP)
- ✅ Endpoints: pointing to host IP
- ✅ Secret: `editorial-db-credentials` (in `editorial` namespace)

## 🔍 Expected Workflow Output

You should see output similar to this:

```
TASK [Display MySQL installation summary] **************************************
ok: [localhost] => {
    "msg": "╔════════════════════════════════════════════════════════════════╗\n║          MySQL Installation Complete                           ║\n╚════════════════════════════════════════════════════════════════╝\n\n📊 DATABASE INFORMATION:\n├─ Host IP: 192.168.1.100\n├─ Port: 3306\n├─ Bind Address: 0.0.0.0 (accessible from cluster)\n├─ Character Set: utf8mb4\n└─ Max Connections: 200\n\n📁 DATABASES CREATED:\n├─ editorial_dev\n├─ editorial_staging\n└─ editorial_prod\n\n👤 DATABASE USER:\n├─ Username: editorial\n├─ Password: ********\n├─ Permissions: ALL on editorial_*.*\n└─ Access: From any host (%)\n\n☸️  KUBERNETES INTEGRATION:\n├─ Namespace: mysql\n├─ Service Name: mysql\n├─ Service ClusterIP: 10.43.100.50\n├─ Endpoint IP: 192.168.1.100 (host)\n└─ DNS: mysql.mysql.svc.cluster.local\n\n✅ CONNECTION TESTS:\n├─ Local: PASSED ✓\n└─ From Cluster: PASSED ✓"
}
```

## 🎯 Next Steps After Deployment

### 1. Deploy Editorial Service

Now that MySQL is ready, deploy the Editorial service:

```bash
# Via ArgoCD (if enabled)
kubectl apply -f argocd/applications/backend/editorial.yaml

# Or manually apply the kustomization
kubectl apply -k environments/dev/apps/editorial-kustomization/
```

### 2. Verify Editorial Connects to MySQL

```bash
# Check editorial pod status
kubectl get pods -n editorial

# View editorial logs
kubectl logs -n editorial -l app=editorial --tail=100

# Look for successful database connection messages
kubectl logs -n editorial -l app=editorial | grep -i mysql
kubectl logs -n editorial -l app=editorial | grep -i database
```

### 3. Deploy Catalog-BFF Service

Once Editorial is running:

```bash
# Via ArgoCD
kubectl apply -f argocd/applications/backend/catalog-bff.yaml

# Or manually
kubectl apply -k environments/dev/apps/catalog-bff-kustomization/
```

## 🔧 Troubleshooting

### Workflow Failed During MySQL Installation

**Check the workflow logs:**
```bash
gh run view --log
```

**Common issues:**

1. **MySQL already installed**
   - Solution: The playbook is idempotent, it should skip or update

2. **Firewall blocking connections**
   - Check: `sudo ufw status`
   - Fix: `sudo ufw allow 3306/tcp`

3. **Permissions error**
   - Check: Ensure `SUDO_PASS` secret is correct
   - Fix: Update the secret

### MySQL Service Not Accessible from Cluster

**Check endpoints:**
```bash
kubectl get endpoints mysql -n mysql -o yaml
```

**Verify the IP matches your host:**
```bash
hostname -I
```

**If IPs don't match, update endpoints:**
```bash
NEW_IP=$(hostname -I | awk '{print $1}')
kubectl patch endpoints mysql -n mysql --type=json \
  -p='[{"op":"replace","path":"/subsets/0/addresses/0/ip","value":"'$NEW_IP'"}]'
```

### Editorial Pod Can't Connect

**Check logs:**
```bash
kubectl logs -n editorial -l app=editorial
```

**Verify secret exists:**
```bash
kubectl get secret editorial-db-credentials -n editorial
```

**Test connection manually:**
```bash
kubectl run debug -it --rm --image=mysql:8.0 -n editorial -- \
  mysql -h mysql.mysql -u editorial -p
```

## 📊 Monitoring

### Check MySQL Status

```bash
# Service status
sudo systemctl status mysql

# Connection count
sudo mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"

# Database sizes
sudo mysql -u root -p -e "
  SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
  FROM information_schema.tables
  WHERE table_schema IN ('editorial_dev', 'editorial_staging', 'editorial_prod')
  GROUP BY table_schema;"
```

### View MySQL Logs

```bash
# Error log
sudo tail -f /var/log/mysql/error.log

# Slow query log (if enabled)
sudo tail -f /var/log/mysql/slow-query.log
```

## 🔄 Re-running Deployment

If you need to update or re-run the MySQL installation:

1. **Re-trigger the workflow** (it's idempotent - safe to run multiple times)
2. **Or run Ansible manually on the host:**
   ```bash
   ansible-playbook platform/host/main.yml \
     -e target_env=development \
     -e mysql_root_password=YourPassword \
     -e mysql_editorial_password=YourPassword
   ```

## 🔐 Security Notes

### Password Rotation

To rotate MySQL passwords:

1. **Update GitHub secrets** with new passwords
2. **Re-run the workflow**
3. **Restart Editorial pods** to pick up new credentials:
   ```bash
   kubectl rollout restart deployment/editorial -n editorial
   ```

### Backup Strategy

Set up regular backups:

```bash
# Create backup script
cat > /opt/wapps/mysql-backup.sh <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/wapps/backups/mysql"
mkdir -p $BACKUP_DIR

mysqldump -u editorial -p$MYSQL_EDITORIAL_PASSWORD \
  --all-databases \
  --single-transaction \
  --quick \
  --lock-tables=false \
  > $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
EOF

chmod +x /opt/wapps/mysql-backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/wapps/mysql-backup.sh") | crontab -
```

## 📞 Support

If you encounter issues:

1. **Check the comprehensive docs**: `platform/cluster/mysql/README.md`
2. **Review implementation guide**: `platform/host/mysql/IMPLEMENTATION.md`
3. **View workflow logs**: `gh run view --log`
4. **Check Ansible playbook**: `platform/host/mysql/install.yml`

## ✅ Deployment Complete!

Once all verification steps pass, your MySQL database is ready and accessible from Kubernetes pods via `mysql.mysql:3306`! 🎉

