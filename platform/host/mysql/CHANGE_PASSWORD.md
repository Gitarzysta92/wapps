# How to Change MySQL Password for wapps_app User

This guide shows how to change the MySQL password for the `wapps_app` user in both MySQL and Kubernetes secrets.

## Overview

When changing the password, you need to update it in **both places**:
1. **MySQL database** - Change the actual user password
2. **Kubernetes secrets** - Update the secrets that applications use

## Method 1: Manual Change (Quick Fix)

### Step 1: Change Password in MySQL

Replace `NEW_PASSWORD` with your desired password:

```bash
# Change password for both localhost and % (remote) hosts
sudo mysql -u root -p'root_password' <<SQL
ALTER USER 'wapps_app'@'localhost' IDENTIFIED BY 'NEW_PASSWORD';
ALTER USER 'wapps_app'@'%' IDENTIFIED BY 'NEW_PASSWORD';
FLUSH PRIVILEGES;
SQL
```

### Step 2: Update Kubernetes Secrets

Update all relevant secrets with the new password:

```bash
# Update shared credentials secret
kubectl create secret generic mysql-credentials \
  --namespace=mysql \
  --from-literal=DATABASE_CLIENT=mysql \
  --from-literal=DATABASE_HOST=mysql.mysql \
  --from-literal=DATABASE_PORT=3306 \
  --from-literal=DATABASE_USERNAME=wapps_app \
  --from-literal=DATABASE_PASSWORD=NEW_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f -

# Update editorial database credentials secret
kubectl create secret generic editorial-db-credentials \
  --namespace=editorial \
  --from-literal=DATABASE_CLIENT=mysql \
  --from-literal=DATABASE_HOST=mysql.mysql \
  --from-literal=DATABASE_PORT=3306 \
  --from-literal=DATABASE_NAME=editorial_dev \
  --from-literal=DATABASE_USERNAME=wapps_app \
  --from-literal=DATABASE_PASSWORD=NEW_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f -

# Update catalog database credentials secret (if exists)
kubectl create secret generic catalog-db-credentials \
  --namespace=catalog \
  --from-literal=DATABASE_CLIENT=mysql \
  --from-literal=DATABASE_HOST=mysql.mysql \
  --from-literal=DATABASE_PORT=3306 \
  --from-literal=DATABASE_NAME=catalog_dev \
  --from-literal=DATABASE_USERNAME=wapps_app \
  --from-literal=DATABASE_PASSWORD=NEW_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Step 3: Restart Pods

Restart all pods that use these credentials:

```bash
# Restart editorial pods
kubectl rollout restart deployment/editorial -n editorial

# Restart catalog pods (if exists)
kubectl rollout restart deployment/catalog -n catalog

# Or restart all deployments in those namespaces
kubectl rollout restart deployment --all -n editorial
kubectl rollout restart deployment --all -n catalog
```

### Step 4: Verify

Test the connection with the new password:

```bash
# Test from host
mysql -u wapps_app -p'NEW_PASSWORD' -h localhost editorial_dev -e "SELECT 'Connection OK' as status;"

# Test from cluster pod
kubectl run mysql-test --rm -it --restart=Never \
  --image=mysql:8.0 \
  --namespace=mysql -- \
  mysql -h mysql.mysql -u wapps_app -p'NEW_PASSWORD' \
  -e "SELECT 'Connection OK' as status;"
```

## Method 2: Using Ansible (Recommended for Long-term)

Re-run the Ansible playbook with the new password:

```bash
ansible-playbook platform/host/main.yml \
  -e target_env=development \
  -e mysql_root_password=YourRootPassword \
  -e mysql_wapps_password=NEW_PASSWORD
```

This will:
- ✅ Update MySQL user passwords (both `localhost` and `%`)
- ✅ Update all Kubernetes secrets automatically
- ✅ Ensure consistency across all environments

## Method 3: Script-Based Change

Create a script to automate the process:

```bash
#!/bin/bash
# change-mysql-password.sh

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <NEW_PASSWORD> [ROOT_PASSWORD]"
    exit 1
fi

NEW_PASSWORD="$1"
ROOT_PASSWORD="${2:-root_password}"

echo "🔐 Changing MySQL password for wapps_app user..."

# Step 1: Update MySQL
sudo mysql -u root -p"$ROOT_PASSWORD" <<SQL
ALTER USER 'wapps_app'@'localhost' IDENTIFIED BY '$NEW_PASSWORD';
ALTER USER 'wapps_app'@'%' IDENTIFIED BY '$NEW_PASSWORD';
FLUSH PRIVILEGES;
SQL

# Step 2: Update Kubernetes secrets
echo "📝 Updating Kubernetes secrets..."

kubectl create secret generic mysql-credentials \
  --namespace=mysql \
  --from-literal=DATABASE_CLIENT=mysql \
  --from-literal=DATABASE_HOST=mysql.mysql \
  --from-literal=DATABASE_PORT=3306 \
  --from-literal=DATABASE_USERNAME=wapps_app \
  --from-literal=DATABASE_PASSWORD="$NEW_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic editorial-db-credentials \
  --namespace=editorial \
  --from-literal=DATABASE_CLIENT=mysql \
  --from-literal=DATABASE_HOST=mysql.mysql \
  --from-literal=DATABASE_PORT=3306 \
  --from-literal=DATABASE_NAME=editorial_dev \
  --from-literal=DATABASE_USERNAME=wapps_app \
  --from-literal=DATABASE_PASSWORD="$NEW_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "🔄 Restarting pods..."
kubectl rollout restart deployment --all -n editorial || true
kubectl rollout restart deployment --all -n catalog || true

echo "✅ Password changed successfully!"
echo "🧪 Testing connection..."
sleep 5
mysql -u wapps_app -p"$NEW_PASSWORD" -h localhost editorial_dev -e "SELECT 'Password change successful!' as status;" && \
  echo "✅ Connection test passed!" || \
  echo "⚠️  Connection test failed - please check the password"
```

Save as `change-mysql-password.sh`, make executable, and run:

```bash
chmod +x change-mysql-password.sh
./change-mysql-password.sh YOUR_NEW_PASSWORD [root_password]
```

## Important Notes

### 1. Update Both Hosts

MySQL treats `localhost` and `%` as separate users. Always update both:

```sql
ALTER USER 'wapps_app'@'localhost' IDENTIFIED BY 'password';
ALTER USER 'wapps_app'@'%' IDENTIFIED BY 'password';
```

### 2. Special Characters in Passwords

If your password contains special characters, escape them properly or use quotes:

```bash
# Example: password with special chars: P@ssw0rd!123
NEW_PASSWORD='P@ssw0rd!123'
```

### 3. Update All Secrets

Make sure to update **all** secrets that use this password:
- `mysql-credentials` (mysql namespace)
- `editorial-db-credentials` (editorial namespace)  
- `catalog-db-credentials` (catalog namespace)
- `editorial-app-secrets` (editorial namespace) - if it exists

### 4. Restart Applications

After updating secrets, **restart the pods** so they pick up the new password:

```bash
kubectl rollout restart deployment/editorial -n editorial
```

### 5. Check GitHub Secrets (if using CI/CD)

If you deployed via GitHub Actions, you may also need to update GitHub repository secrets:
- `EDITORIAL_DATABASE_PASSWORD`
- Any other related secrets

## Troubleshooting

### Password Changed But Connection Still Fails

1. **Verify secret was updated:**
   ```bash
   kubectl get secret editorial-db-credentials -n editorial -o jsonpath='{.data.DATABASE_PASSWORD}' | base64 -d && echo
   ```

2. **Restart pods** (they cache old credentials):
   ```bash
   kubectl rollout restart deployment/editorial -n editorial
   ```

3. **Check MySQL password directly:**
   ```bash
   mysql -u wapps_app -p'NEW_PASSWORD' -h localhost -e "SELECT 1;"
   ```

### Secret Not Updating

Use `--force` or delete and recreate:

```bash
kubectl delete secret editorial-db-credentials -n editorial
# Then recreate with kubectl create secret...
```

### Password Contains Special Characters

Escape properly or use single quotes:

```bash
# ❌ Wrong - will break
PASSWORD="P@ssw0rd!123"

# ✅ Correct - use single quotes
PASSWORD='P@ssw0rd!123'
# Or escape in double quotes
PASSWORD="P@ssw0rd\!123"
```

## Security Best Practices

1. **Use strong passwords**: Minimum 16 characters with mix of letters, numbers, and symbols
2. **Rotate regularly**: Change passwords every 90 days
3. **Use secrets management**: Consider using Vault or similar for production
4. **Document changes**: Keep track of when passwords are changed
5. **Test after change**: Always verify connections work after password change

## Quick Reference

```bash
# Change MySQL password
sudo mysql -u root -p -e "ALTER USER 'wapps_app'@'localhost' IDENTIFIED BY 'NEW_PASS'; ALTER USER 'wapps_app'@'%' IDENTIFIED BY 'NEW_PASS'; FLUSH PRIVILEGES;"

# Update secret
kubectl create secret generic editorial-db-credentials -n editorial --from-literal=DATABASE_PASSWORD=NEW_PASS --dry-run=client -o yaml | kubectl apply -f -

# Restart pods
kubectl rollout restart deployment/editorial -n editorial
```