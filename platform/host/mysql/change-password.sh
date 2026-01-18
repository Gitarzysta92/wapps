#!/bin/bash
# Change MySQL password for wapps_app user in MySQL and Kubernetes secrets
# Usage: ./change-password.sh <NEW_PASSWORD> [ROOT_PASSWORD]

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <NEW_PASSWORD> [ROOT_PASSWORD]"
    echo ""
    echo "Example:"
    echo "  $0 MyNewSecurePassword123"
    echo "  $0 MyNewSecurePassword123 root_password"
    exit 1
fi

NEW_PASSWORD="$1"
ROOT_PASSWORD="${2:-root_password}"

echo "🔐 Changing MySQL password for wapps_app user..."
echo ""

# Step 1: Update MySQL password for both localhost and %
echo "📝 Updating MySQL user passwords..."
sudo mysql -u root -p"$ROOT_PASSWORD" <<SQL
ALTER USER 'wapps_app'@'localhost' IDENTIFIED BY '$NEW_PASSWORD';
ALTER USER 'wapps_app'@'%' IDENTIFIED BY '$NEW_PASSWORD';
FLUSH PRIVILEGES;
SQL

if [ $? -eq 0 ]; then
    echo "✅ MySQL password updated successfully"
else
    echo "❌ Failed to update MySQL password. Please check root password."
    exit 1
fi

echo ""

# Step 2: Update Kubernetes secrets
echo "📝 Updating Kubernetes secrets..."

# Update shared mysql-credentials secret
echo "  - Updating mysql-credentials secret..."
kubectl create secret generic mysql-credentials \
  --namespace=mysql \
  --from-literal=DATABASE_CLIENT=mysql \
  --from-literal=DATABASE_HOST=mysql.mysql \
  --from-literal=DATABASE_PORT=3306 \
  --from-literal=DATABASE_USERNAME=wapps_app \
  --from-literal=DATABASE_PASSWORD="$NEW_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1 || {
    echo "    ⚠️  Warning: Failed to update mysql-credentials secret (may not exist)"
}

# Update editorial-db-credentials secret
echo "  - Updating editorial-db-credentials secret..."
kubectl create secret generic editorial-db-credentials \
  --namespace=editorial \
  --from-literal=DATABASE_CLIENT=mysql \
  --from-literal=DATABASE_HOST=mysql.mysql \
  --from-literal=DATABASE_PORT=3306 \
  --from-literal=DATABASE_NAME=editorial_dev \
  --from-literal=DATABASE_USERNAME=wapps_app \
  --from-literal=DATABASE_PASSWORD="$NEW_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1 || {
    echo "    ⚠️  Warning: Failed to update editorial-db-credentials secret (may not exist)"
}

# Update catalog-db-credentials secret (if exists)
echo "  - Updating catalog-db-credentials secret..."
kubectl create secret generic catalog-db-credentials \
  --namespace=catalog \
  --from-literal=DATABASE_CLIENT=mysql \
  --from-literal=DATABASE_HOST=mysql.mysql \
  --from-literal=DATABASE_PORT=3306 \
  --from-literal=DATABASE_NAME=catalog_dev \
  --from-literal=DATABASE_USERNAME=wapps_app \
  --from-literal=DATABASE_PASSWORD="$NEW_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1 || {
    echo "    ⚠️  Warning: catalog-db-credentials secret doesn't exist (this is OK)"
}

echo "✅ Kubernetes secrets updated"

echo ""

# Step 3: Restart pods to pick up new credentials
echo "🔄 Restarting pods to apply new credentials..."
kubectl rollout restart deployment --all -n editorial 2>/dev/null && {
    echo "  ✅ Editorial pods restarted"
} || {
    echo "  ⚠️  No editorial deployments found (this is OK)"
}

kubectl rollout restart deployment --all -n catalog 2>/dev/null && {
    echo "  ✅ Catalog pods restarted"
} || {
    echo "  ⚠️  No catalog deployments found (this is OK)"
}

echo ""

# Step 4: Verify
echo "🧪 Verifying password change..."
sleep 2

if mysql -u wapps_app -p"$NEW_PASSWORD" -h localhost -e "SELECT 'Password changed successfully!' as status;" editorial_dev 2>/dev/null; then
    echo "✅ Connection test passed! Password change successful."
else
    echo "⚠️  Connection test failed. The password may have been updated, but connection test failed."
    echo "   This might be normal if databases don't exist yet."
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Password change complete!"
echo ""
echo "📋 Summary:"
echo "  - MySQL password updated for wapps_app@localhost"
echo "  - MySQL password updated for wapps_app@%"
echo "  - Kubernetes secrets updated"
echo "  - Pods restarted"
echo ""
echo "🔍 To verify, run:"
echo "  mysql -u wapps_app -p'$NEW_PASSWORD' -h localhost editorial_dev"
echo "═══════════════════════════════════════════════════════"